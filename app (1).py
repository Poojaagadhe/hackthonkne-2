
import streamlit as st
import pandas as pd
from datetime import datetime
import os
from streamlit_folium import st_folium
import folium
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

st.set_page_config(page_title="Civic Issue Tracker", layout="wide")
DATA_FILE = "complaints.csv"

ADMIN_EMAIL = "test@example.com"
ADMIN_APP_PASSWORD = "dummy"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587

def send_email_notification(receiver_email, complaint_id, title, new_status):
    print(f"📧 Email simulated: {receiver_email} | Status: {new_status}")

# Load or create CSV
if os.path.exists(DATA_FILE):
    df = pd.read_csv(DATA_FILE)
else:
    df = pd.DataFrame(columns=[
        "id", "title", "description", "email", "latitude", "longitude",
        "status", "photo", "timestamp"
    ])
    df.to_csv(DATA_FILE, index=False)

# Sidebar
st.sidebar.title("Navigation")
page = st.sidebar.radio("Go to", [
    "📋 Report Issue",
    "📊 View Complaints",
    "🛠️ Admin Dashboard",
    "🌎 Public Dashboard",
    "🤖 Chatbot Assistant"
])

# ----------------------------
# Report Issue
# ----------------------------
if page == "📋 Report Issue":
    st.header("📝 Report a New Civic Issue")
    title = st.text_input("Issue Title")
    desc = st.text_area("Description")
    email = st.text_input("Your Email Address (for updates)")

    st.markdown("### Select Location on Map")
    m = folium.Map(location=[20.5937, 78.9629], zoom_start=5)
    map_click = st_folium(m, width=700, height=400)
    lat, lon = None, None
    if map_click and map_click.get("last_clicked"):
        lat = map_click["last_clicked"]["lat"]
        lon = map_click["last_clicked"]["lng"]
        st.success(f"📍 Location selected: ({lat:.4f}, {lon:.4f})")

    photo = st.file_uploader("Upload a photo (optional)", type=["png", "jpg", "jpeg"])

    if st.button("Submit Complaint"):
        if not title or not desc or not email:
            st.error("⚠️ Please fill all required fields.")
        else:
            new_id = len(df) + 1
            photo_path = f"photo_{new_id}.jpg" if photo else ""
            if photo:
                with open(photo_path, "wb") as f:
                    f.write(photo.getbuffer())

            new_row = {
                "id": new_id,
                "title": title,
                "description": desc,
                "email": email,
                "latitude": lat if lat else "",
                "longitude": lon if lon else "",
                "status": "Pending",
                "photo": photo_path,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            df.to_csv(DATA_FILE, index=False)
            st.success(f"✅ Complaint #{new_id} submitted successfully!")

# ----------------------------
# View Complaints
# ----------------------------
elif page == "📊 View Complaints":
    st.header("📋 All Reported Issues")
    if len(df) == 0:
        st.info("No complaints reported yet.")
    else:
        st.dataframe(df)
        st.map(df[["latitude", "longitude"]].dropna())

# ----------------------------
# Admin Dashboard
# ----------------------------
elif page == "🛠️ Admin Dashboard":
    st.header("👩‍💼 Admin Panel — Update Status")
    if len(df) == 0:
        st.info("No complaints to manage.")
    else:
        selected_id = st.selectbox("Select Complaint ID", df["id"])
        current_status = df.loc[df["id"] == selected_id, "status"].values[0]
        title = df.loc[df["id"] == selected_id, "title"].values[0]
        receiver_email = df.loc[df["id"] == selected_id, "email"].values[0]

        st.write(f"Current Status: **{current_status}**")

        new_status = st.selectbox(
            "Update Status",
            ["Pending", "In Progress", "Resolved"],
            index=["Pending", "In Progress", "Resolved"].index(current_status)
        )

        if st.button("Update Status"):
            df.loc[df["id"] == selected_id, "status"] = new_status
            df.to_csv(DATA_FILE, index=False)
            send_email_notification(receiver_email, selected_id, title, new_status)
            st.success(f"Complaint #{selected_id} marked as '{new_status}'.")

# ----------------------------
# Public Dashboard
# ----------------------------
elif page == "🌎 Public Dashboard":
    st.header("🌟 Public Transparency Dashboard — Resolved Issues")
    resolved_df = df[df["status"] == "Resolved"]

    if len(resolved_df) == 0:
        st.info("No resolved complaints yet.")
    else:
        m = folium.Map(location=[20.5937, 78.9629], zoom_start=5)
        for _, row in resolved_df.iterrows():
            if pd.notna(row["latitude"]) and pd.notna(row["longitude"]):
                popup_text = f"<b>{row['title']}</b><br>{row['description']}<br><i>{row['timestamp']}</i>"
                folium.Marker(
                    [row["latitude"], row["longitude"]],
                    tooltip=row["title"],
                    popup=popup_text,
                    icon=folium.Icon(color="green", icon="check")
                ).add_to(m)
        st_folium(m, width=700, height=450)
        st.subheader("✅ List of Resolved Complaints")
        st.dataframe(resolved_df[["id", "title", "timestamp"]])

# ----------------------------
# Chatbot Assistant
# ----------------------------
elif page == "🤖 Chatbot Assistant":
    st.header("🤖 Civic Help Chatbot")
    st.write("Ask me: *What's the status of complaint #2?*")

    user_input = st.text_input("You:", "")
    if st.button("Ask"):
        if not user_input:
            st.warning("Please type something first.")
        else:
            match = re.search(r"#?(\d+)", user_input)
            if match:
                comp_id = int(match.group(1))
                if comp_id in df["id"].values:
                    status = df.loc[df["id"] == comp_id, "status"].values[0]
                    st.info(f"Complaint #{comp_id} is currently **{status}**.")
                else:
                    st.error("Complaint ID not found.")
            else:
                st.write("💬 Include a complaint number, e.g., #2")
