# Comprehensive Project Specification: Internal Café Supply & Operations Platform

## 1. Executive Summary
**Project Objective:** To design, develop, and deploy a closed-ecosystem, cross-platform mobile application (iOS and Android) that centralizes internal ordering, production, delivery, and accounting for a 7-location café brand. 

**Core Concept:**
As the brand expands, relying on ad-hoc communication (text messages, phone calls) between the branches and the central production hub creates inefficiencies, waste, and order errors. This application serves as a dedicated B2B Enterprise Resource Planning (ERP) platform. It will manage dynamic product catalogs, enforce strict order-timing rules, execute a specialized dual-approval workflow, route approved orders to delivery personnel, generate automated financial reports, and build a foundational database for future AI-driven predictive ordering.

---

## 2. System Architecture: User Roles & Permissions
The system requires a strict role-based access control (RBAC) environment. Upon launch, the system will manage **19 distinct login profiles**, divided strictly by operational function to ensure users only interact with data relevant to their specific jobs.

### A. The Satellite Shops (14 Logins total: 7 Locations × 2 Roles)
Each of the 7 café locations will have two separate accounts to prevent cross-departmental confusion:
* **Front of House (FOH) Manager:** Places orders for items relevant to the display and barista stations. Examples: specific baked goods, pastries, coffee beans, syrups, and retail items.
* **Shop Kitchen Manager:** Places orders for raw ingredients, prepped items, and heavy stock needed for the back-of-house. Examples: raw meats, bulk flour, vegetables, sauces.

### B. The Central Hub / Production (5 Specialized Logins)
The production facility operates with distinct departments. App views are heavily filtered so specialists only see their domain:
* **Meat Specialist:** Only views and manages aggregated orders related to butchery and meat prep (e.g., specific cuts, cooked vs. raw).
* **Bread Baker:** Only views daily bread production requirements and dough schedules.
* **Pastry / Bakery Chef:** Only views orders for sweets, delicate pastries, and cakes.
* **Delivery Courier:** Does not see pending or unapproved orders. Only receives finalized manifests, optimized routing, and digital sign-off screens.
* **System Admin / Brand Owner:** Holds absolute visibility. Can view all shops, track production pipelines, monitor delivery movements in real-time, manage the master catalog, and access all financial reporting.

---

## 3. The "Two-Way Handshake" Approval & Task Routing Workflow
To eliminate discrepancies, prevent overpromising, and ensure complete alignment between the supply side (Hub) and demand side (Shop), all orders must pass through a strict dual-approval sequence.

### Step-by-Step Approval Process:
1.  **Initial Request (The Shop):** The Shop (Kitchen or FOH) builds their cart and submits a request (e.g., *5kg of Sous-Vide Lamb, 20 Croissants*). This is categorized as a **"Pending Request"**, *not* a confirmed order.
2.  **Specialist Review (Approval 1):** The request routes exclusively to the relevant Hub specialist (e.g., Meat orders to the Meat Specialist, Croissants to the Pastry Chef). The specialist reviews the request to verify they have the raw materials and bandwidth to fulfill the specific modifiers. The specialist taps **"Approve & Quote."**
3.  **Shop Confirmation (Approval 2):** The approved request bounces back to the initiating Shop with an alert. The Shop Manager reviews the specialist's approval (ensuring no details were altered and acknowledging fulfillment capability) and taps **"Final Confirm."**
4.  **Simultaneous Routing:** The moment the Shop provides the Final Confirm, the system triggers two automated actions concurrently:
    * **To the Courier's Queue:** The confirmed order is pushed to the Delivery Courier’s logistics engine to begin routing.
    * **To the Specialist's To-Do Board:** The item physically moves out of the Specialist's "Pending" inbox and drops into their active production pipeline.

### Specialist Interface Management
To support this workflow without overwhelming Hub staff, their UI is divided into two distinct screens:
* **The Inbox (Pending Requests):** A staging area solely for reviewing, accepting, or modifying incoming requests.
* **The To-Do Board (Active Production):** Acts as a digital kitchen ticket rail. Confirmed orders live here while the specialist physically cuts, cooks, and packages the items.
* **State Tracking:** Specialists update the order state as they work: `[In Progress]` → `[Packaged]` → `[Ready for Courier]`.

---

## 4. Advanced Product Catalog
Because the hub produces highly variable items, the catalog uses a nested structure: **Category → Item → Modifier**.

* **Categorization:** Items are split into distinct production zones (Meat, Bread, Pastry, General Pantry).
* **Preparation Modifiers:** Selecting a base item (e.g., "Beef" or "Lamb") prompts mandatory modifier selections based on Hub capabilities:
    * *Cut:* Leg, shoulder, chops, minced.
    * *Prep State:* Raw, marinated, fully cooked, sous-vide.
* **Customization Notes:** A text field for specific requests (e.g., *"Slice thicker than usual for weekend special"*).

---

## 5. Strict Timing Protocols & Order Rules
To prevent operational chaos, the system enforces automated cut-off times and lead requirements.

* **Dynamic Lead Times:** The app physically prevents shops from selecting delivery dates that violate prep times. For example, artisanal sourdough might require a 48-hour lead time (for fermentation), while cooked meat might require 24 hours.
* **The Daily Universal Cut-Off:** A strict lock-out time (e.g., 4:00 PM). If a shop misses this cut-off, the app automatically pushes their earliest delivery availability to the next valid operational day.
* **Countdown UI:** The shop interface features a persistent, visual countdown timer (e.g., *"⏳ 2 hours and 15 minutes left to place tomorrow's meat order"*).

---

## 6. Automated Accounting & Financial Receipts
To eliminate manual paperwork and assist with internal cost-tracking:

* **Daily Dispatch Receipts (PDF):** When the delivery courier hands over the goods and the Shop Manager signs off in the app, the system immediately generates a digital PDF receipt. One copy is logged in the Shop's profile, and one is sent to the Admin.
* **Monthly Statements:** On the 1st of every month, the platform aggregates all daily receipts into a master monthly invoice per branch. This allows the business owner to accurately track inventory consumption rates, calculate individual branch profitability, and manage internal departmental billing.

---

## 7. UX & Interface Recommendations
To ensure high adoption and zero confusion among staff:

* **"Standard Daily Order" Templates:** Shops can save their baseline orders. A manager should be able to order their standard Tuesday inventory in two taps, rather than building a cart from scratch daily.
* **Color-Coded Production Screens:** Hub dashboards use color psychology to indicate urgency or zone (e.g., Red = Needs prep today, Green = Prepped and ready for driver).
* **Live Inventory "86" Button:** If a specialist ruins a batch or runs out of raw product, they can tap an "Out of Stock" (86) toggle. This instantly updates the catalog across all 7 shops, preventing further orders and sending a push notification so shops can adjust their customer-facing menus.

---

## 8. Phase 2: AI & Predictive Benchmarking (The Data Foundation)
While the initial launch focuses on executing orders flawlessly, every transaction, timestamp, and location data point will be saved to a structured database to build an intelligent forecasting model for Phase 2.

After accumulating 6–12 months of historical data, the system will introduce **Smart Order Suggestions**. The AI engine will analyze:
1.  **Historical Baselines:** Trailing averages (e.g., "Shop C consumes 20% more pastry on Tuesdays").
2.  **Weather APIs:** Correlating weather patterns with sales (e.g., "Rain historically drops cold-brew and pastry sales by 15% at the Downtown branch").
3.  **Local Events API:** Tracking spikes correlated with nearby football matches, concerts, or city festivals.

**The Result:** When a Shop Kitchen logs in to order, the app will auto-fill a suggested cart, stating: 
> *"Based on tomorrow's sunny forecast and the local festival nearby, we suggest ordering 15kg of lamb instead of your usual 10kg baseline."*

---

## 9. Recommended Technical Stack
* **Frontend (Mobile App):** Flutter or React Native (Allows for a single codebase to deploy to both iOS and Android simultaneously, reducing development costs).
* **Backend & Database:** Firebase (Cloud Firestore) or AWS (Amplify/DynamoDB) for real-time data syncing, instant push notifications, and robust role-based authentication.
* **Offline Support:** Implementation of a local caching layer (SQLite/Room) so branches can view their order status and pending deliveries even if their local Wi-Fi drops.
