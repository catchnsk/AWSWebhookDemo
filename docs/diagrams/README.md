# Architecture Diagrams - How to Use

This folder contains professional architecture diagrams for the Webhook Management System.

---

## 📁 Files

1. **webhook-system-architecture.drawio** - Main draw.io file with 4 diagrams
2. **architecture-diagrams.md** - ASCII art diagrams for documentation

---

## 🎨 Opening in Draw.io (diagrams.net)

### Option 1: Online (Easiest)

1. Go to https://app.diagrams.net (or https://draw.io)
2. Click **"Open Existing Diagram"**
3. Choose **"From Device"**
4. Select `webhook-system-architecture.drawio`
5. Done! You'll see 4 tabs at the bottom:
   - **1-High-Level-Architecture**
   - **2-Data-Flow**
   - **3-AWS-Infrastructure**
   - **4-Database-ERD**

### Option 2: Desktop App

1. Download Draw.io Desktop: https://github.com/jgraph/drawio-desktop/releases
2. Install the application
3. Open `webhook-system-architecture.drawio` directly
4. Edit and save locally

### Option 3: VS Code Extension

1. Install the **Draw.io Integration** extension in VS Code
2. Right-click `webhook-system-architecture.drawio`
3. Select **"Open with... > Draw.io Editor"**
4. Edit directly in VS Code

---

## 📊 What's Inside

### Diagram 1: High-Level Architecture
Shows the complete system with:
- Producers & Subscribers (external actors)
- API Gateway (entry point)
- 6 Lambda Functions (business logic)
- PostgreSQL Database (data storage)
- Kafka Topics (message queue)
- AWS Supporting Services (Glue, SES, Secrets Manager, CloudWatch)
- Egress Gateway (webhook delivery)

**Use this for:** Executive presentations, system overviews, onboarding new team members

---

### Diagram 2: Data Flow
Step-by-step flow showing:
1. Publish Event (Producer → API Gateway)
2. Validate Schema (AWS Glue Schema Registry)
3. Get Subscriptions (Database query)
4. Publish to Kafka (delivery-messages topic)
5. Consume & Deliver (Delivery Consumer → Egress Gateway)
6. Success or Retry (Handle responses)
7. Retry Processing (Retry Consumer)
8. Dead Letter Queue (Max retries exceeded)

**Use this for:** Understanding the event lifecycle, troubleshooting delivery issues, training developers

---

### Diagram 3: AWS Infrastructure
Detailed AWS setup with:
- VPC with public/private subnets (Multi-AZ)
- NAT Gateways & Internet Gateway
- Lambda functions in private subnets
- RDS PostgreSQL (Multi-AZ with primary & standby)
- MSK Kafka (3-broker cluster across 3 AZs)
- Security groups & network ACLs
- AWS services outside VPC (API Gateway, SES, Glue, CloudWatch, X-Ray, Route 53)

**Use this for:** Infrastructure planning, security reviews, cost estimation, DevOps setup

---

### Diagram 4: Database ERD (Entity Relationship Diagram)
Shows all 9 tables with:
- **producers** (1:N) → **schemas**
- **subscribers** (1:N) → **subscriptions**
- **schemas** (1:N) → **subscriptions**
- **event_messages** (1:N) → **delivery_logs**
- **subscriptions** (1:N) → **delivery_logs**
- **delivery_logs** (1:1) → **delivery_dlq**

Plus: schema_approvals, notification_logs

**Use this for:** Database design, query optimization, data modeling, understanding relationships

---

## ✏️ Editing Diagrams

### Change Colors
1. Select any shape
2. Click the **Fill Color** button in the toolbar
3. Choose a new color

### Add New Shapes
1. Drag shapes from the left sidebar
2. AWS shapes are under **"AWS" category** in the left panel
3. Standard shapes: rectangles, cylinders, clouds

### Edit Text
1. Double-click any shape
2. Type to edit text
3. Use toolbar for font size, bold, alignment

### Add Arrows/Connections
1. Hover over a shape until blue arrows appear
2. Click and drag the blue arrow to another shape
3. Or use the **Connector** tool in the toolbar

### Export Diagrams

#### As PNG (for presentations)
1. Click **File → Export as → PNG**
2. Set resolution (e.g., 200% for high quality)
3. Check **"Selection Only"** to export just one diagram
4. Click **Export**

#### As SVG (for websites, scalable)
1. Click **File → Export as → SVG**
2. Choose options
3. Click **Export**

#### As PDF (for documentation)
1. Click **File → Export as → PDF**
2. Choose page layout
3. Click **Export**

---

## 🖼️ Example Use Cases

### For Presentations
1. Open diagram in draw.io
2. Export as PNG (200% resolution)
3. Insert into PowerPoint/Google Slides

### For Documentation
1. Export as SVG
2. Include in Markdown or HTML docs
3. SVG scales perfectly at any size

### For Confluence/Notion
1. Export as PNG
2. Upload directly to page
3. Or use draw.io Confluence plugin

### For GitHub/GitLab
1. Export as PNG
2. Add to README.md:
   ```markdown
   ![Architecture](docs/diagrams/architecture.png)
   ```

---

## 🎯 Tips & Tricks

### Aligning Shapes
- Select multiple shapes
- Click **Arrange → Align** in top menu
- Choose alignment (left, center, right, distribute)

### Grouping Shapes
- Select multiple shapes (hold Shift)
- Right-click → **Group**
- Now they move together

### Layers (for complex diagrams)
- Click **View → Layers**
- Create layers for different components
- Toggle visibility to focus on specific areas

### Containers (swimlanes)
- Drag **"Container"** or **"Swimlane"** from left panel
- Drop shapes inside
- Great for grouping related components

### Keyboard Shortcuts
- **Ctrl+C / Cmd+C**: Copy
- **Ctrl+V / Cmd+V**: Paste
- **Ctrl+D / Cmd+D**: Duplicate
- **Ctrl+G / Cmd+G**: Group
- **Ctrl+Shift+G / Cmd+Shift+G**: Ungroup
- **Delete**: Remove shape
- **Arrow keys**: Move shape by 1px
- **Shift+Arrow**: Move by 10px

---

## 🔄 Updating Diagrams

When architecture changes:

1. Open `webhook-system-architecture.drawio` in draw.io
2. Switch to the appropriate tab (bottom of screen)
3. Make your changes
4. Click **File → Save** (if using desktop app)
5. Or download and replace the file (if using web version)
6. Commit changes to Git:
   ```bash
   git add docs/diagrams/webhook-system-architecture.drawio
   git commit -m "Update architecture diagram: [describe change]"
   git push
   ```

---

## 📤 Sharing Diagrams

### With Non-Technical Stakeholders
- Export Diagram 1 (High-Level) as PNG
- Use simple colors and labels
- Add a legend if needed

### With Engineering Team
- Share the `.drawio` file directly
- They can open and edit in draw.io
- Or export Diagram 3 (AWS Infrastructure) as PDF

### For Documentation
- Export as SVG for best quality
- Or use PNG at 200% resolution
- Include in wiki, Confluence, or README

---

## 🆘 Troubleshooting

### Can't open .drawio file
- Make sure you're using https://app.diagrams.net or the desktop app
- Don't try to open in text editor (it's XML)

### Diagram looks blurry
- Export at higher resolution (200% or 300%)
- Or use SVG format which scales perfectly

### Lost changes
- Draw.io auto-saves if using desktop app
- Web version: click **File → Save As** frequently
- Enable version control in draw.io: **Extras → Autosave**

### Want to create a new diagram
1. Click **File → New**
2. Choose template or start blank
3. Use the sidebar for shapes
4. Save as new file

---

## 🎨 Color Scheme Reference

We use consistent colors across diagrams:

| Component | Color | Hex Code |
|-----------|-------|----------|
| **Producers/External** | Light Blue | `#dae8fc` |
| **Subscribers/External** | Light Green | `#d5e8d4` |
| **API Gateway** | Light Yellow | `#fff2cc` |
| **Lambda Functions** | Light Purple | `#e1d5e7` |
| **Database (RDS)** | Light Blue | `#dae8fc` |
| **Kafka/MSK** | Light Yellow | `#fff2cc` |
| **Egress Gateway** | Light Red | `#f8cecc` |
| **AWS Glue** | Light Orange | `#ffe6cc` |
| **Supporting Services** | Light Green | `#d5e8d4` |
| **Containers/Groups** | Light Gray | `#f5f5f5` |

---

## 📚 Additional Resources

- **Draw.io Documentation**: https://www.diagrams.net/doc/
- **AWS Architecture Icons**: https://aws.amazon.com/architecture/icons/
- **C4 Model (for software architecture)**: https://c4model.com/
- **ArchiMate (enterprise architecture)**: https://www.opengroup.org/archimate-forum

---

## 🔗 Related Documentation

- [ENHANCED_ARCHITECTURE.md](../ENHANCED_ARCHITECTURE.md) - Detailed architecture description
- [API_SPECIFICATION.md](../API_SPECIFICATION.md) - REST API documentation
- [DEVELOPMENT_EFFORT_ESTIMATE.md](../DEVELOPMENT_EFFORT_ESTIMATE.md) - Time & cost estimates
- [AWS_COST_ESTIMATE.md](../AWS_COST_ESTIMATE.md) - Monthly infrastructure costs

---

## ✅ Checklist: Creating New Diagrams

When adding new architecture diagrams:

- [ ] Use consistent color scheme (see table above)
- [ ] Add title at the top
- [ ] Include legend for symbols/colors
- [ ] Label all connections/arrows
- [ ] Show data flow direction
- [ ] Add to existing `.drawio` file as new tab
- [ ] Export as PNG for quick reference
- [ ] Update this README if needed
- [ ] Commit to Git with descriptive message

---

**Need help?**
- Check draw.io forums: https://github.com/jgraph/drawio/discussions
- Or ask your team lead for assistance

**Happy diagramming!** 🎨
