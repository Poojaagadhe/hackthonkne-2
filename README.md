# Civic Issue Tracker 🏙️

A **web application** to report, track, and visualize civic issues such as potholes, garbage, and streetlight failures. Built using **Streamlit**, **Pandas**, and **Folium**, this app promotes **citizen engagement** and **government transparency**.  

---

## **Features**

### 1. Report Issues 
- Users can submit complaints with:
  - **Title** and **Description**
  - **Photo** (optional)
  - **Location** via interactive map
- Each complaint is assigned a unique ID and timestamp.

### 2. View Complaints 
- Users can view **all reported complaints** in a table.
- Map view shows complaint locations (latitude & longitude).

### 3. Admin Dashboard 
- Admins can update the status of complaints:  
  `Pending → In Progress → Resolved`
- Sends **email notifications** to users upon status updates.

### 4. Public Dashboard 
- Displays **resolved complaints** to promote transparency.
- Includes:
  - Interactive map with resolved complaint markers
  - Filter by **date range** or **keywords**
  - Display of complaint photos

### 5. Chatbot Assistant 
- Simple chatbot to query complaint status by ID.
- Shows the complaint status and photo if available.

---

## **Installation & Local Testing**
1. Clone this repository:
   
git clone https://github.com/<your-username>/civic-issue-tracker.git
cd civic-issue-tracker

2. pip install -r requirements.txt

3. streamlit run app.py



1. Clone this repository:

```bash
git clone https://github.com/<your-username>/civic-issue-tracker.git
cd civic-issue-tracker

