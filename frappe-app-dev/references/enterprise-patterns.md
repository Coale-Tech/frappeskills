# Enterprise Application Patterns

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `enterprise-patterns/SKILL.md`.

## Frappe Enterprise Patterns

Architectural patterns for building production-grade enterprise applications.

### When to use

- Building CRM, Helpdesk, HRMS, or similar multi-entity systems
- Designing SLA-driven workflows
- Implementing assignment and queue management
- Building audit trails and activity logs
- Integrating with external systems (email, telephony, CRM)

### Inputs required

- System type (CRM/Helpdesk/custom)
- Core entities and relationships
- SLA requirements
- Workflow states and transitions
- Integration points

### Procedure

#### 0) Design data model

Start with clear, normalized DocTypes:

```
Ticket (parent)
├── customer (Link: Customer)
├── assigned_to (Link: User)
├── status (Select: Open, In Progress, Resolved, Closed)
├── priority (Link: Priority)
├── sla (Link: SLA)
├── activities (Table: Ticket Activity)
└── response_by, resolution_by (Datetime)
```

**Key patterns:**
- Use Link fields for relationships
- Use child tables for activities, timelines, line items
- Use Dynamic Link when target DocType varies

#### 1) Implement state machine

**Option A: Workflow DocType**
- Create Workflow with states and role-based transitions
- Link to your DocType

**Option B: docstatus for submission flow**
| docstatus | Meaning |
|-----------|---------|
| 0 | Draft |
| 1 | Submitted |
| 2 | Cancelled |

**Option C: Custom status field with validation**
```python
def validate(self):
    allowed = self.get_allowed_transitions()
    if self.status not in allowed:
        frappe.throw(f"Cannot transition to {self.status}")
```

#### 2) Set up permissions

**Row-level filtering:**
- Use User Permissions to restrict by entity
- Combine with Role Permissions

**Always re-check in RPC methods:**
```python
@frappe.whitelist()
def update_ticket(name, status):
    doc = frappe.get_doc("Ticket", name)
    if not frappe.has_permission("Ticket", "write", doc):
        frappe.throw("Not permitted", frappe.PermissionError)
    doc.status = status
    doc.save()
```

#### 3) Build activity trail

Track changes using Activity Log or custom child table:

```python
def on_update(self):
    if self.has_value_changed("status"):
        self.append("activities", {
            "action": "Status Change",
            "old_value": self._doc_before_save.status,
            "new_value": self.status,
            "timestamp": frappe.utils.now()
        })
```

#### 4) Implement SLA

**SLA DocType:**
```
SLA
├── entity_type (Link: DocType)
├── response_time (Duration)
├── resolution_time (Duration)
└── escalation_rules (Table: Escalation Rule)
```

**Apply SLA on creation:**
```python
def after_insert(self):
    sla = get_applicable_sla(self)
    if sla:
        self.response_by = add_to_date(self.creation, hours=sla.response_time)
        self.resolution_by = add_to_date(self.creation, hours=sla.resolution_time)
        self.db_update()
```

**Monitor breaches (scheduled job):**
```python
def check_sla_breaches():
    tickets = frappe.get_all("Ticket", 
        filters={"status": ["not in", ["Resolved", "Closed"]]},
        fields=["name", "resolution_by"]
    )
    for t in tickets:
        if frappe.utils.now_datetime() > t.resolution_by:
            mark_sla_breached(t.name)
```

#### 5) Assignment and queues

**Round-robin assignment:**
```python
def assign_next_agent(queue):
    agents = frappe.get_all("Queue Member",
        filters={"queue": queue, "available": 1},
        fields=["user", "current_load"],
        order_by="current_load asc"
    )
    if agents:
        return agents[0].user
    return None
```

**Assignment Rules DocType** for automatic assignment.

#### 6) Notifications and escalations

**Configure Notification DocType for:**
- SLA approaching breach
- Assignment changes
- Status transitions
- Customer replies

**Escalation chain:**
```
Level 1 (0h): Notify assigned agent
Level 2 (4h): Notify team lead
Level 3 (8h): Notify manager
Level 4 (24h): Notify department head
```

#### 7) External integrations

**Centralize in `integrations/` module:**
```python
# my_app/integrations/email_connector.py
def sync_emails():
    # Fetch from Email Account
    # Create Communications
    # Link to Tickets
```

**Use background jobs for sync:**
```python
frappe.enqueue(
    "my_app.integrations.email_connector.sync_emails",
    queue="long",
    timeout=600
)
```

### Verification

- [ ] Workflow transitions work for all roles
- [ ] Permissions enforced at API level
- [ ] Activity log captures all changes
- [ ] SLA calculation correct
- [ ] Notifications fire appropriately
- [ ] Integration sync runs without errors

### Failure modes / debugging

- **Permission bypass**: Check RPC methods have explicit permission checks
- **SLA not applying**: Verify scheduled job is running
- **Activities not logging**: Check `has_value_changed` usage
- **Notifications not sending**: Check Notification rules and email queue

### Escalation

- For complex permission patterns, see [references/advanced-permissions.md](./advanced-permissions.md)
- For queue optimization, see [references/queue-patterns.md](./queue-patterns.md)
- For UI/UX patterns → `ui-patterns`

### References

- [references/workflow-patterns.md](./workflow-patterns.md) - State machine design
- [references/sla-implementation.md](./sla-patterns.md) - SLA details
- [references/integration-patterns.md](./integration-patterns.md) - External systems

### Guardrails

- **Follow CRM/Helpdesk UI patterns**: For CRUD apps, follow `ui-patterns` skill which documents app shell, navigation, list views, and form patterns from official Frappe apps. This includes sidebar layouts, quick filters, Kanban views, and detail panels.
- **Use Frappe UI for frontends**: All custom enterprise frontends must use Frappe UI (Vue 3 + TailwindCSS) — never vanilla JS or jQuery
- **Design workflows carefully**: Map all states and transitions before implementation; consider rollback paths
- **Handle edge cases**: Plan for cancelled, on-hold, and exception states in workflows
- **Test performance early**: Run load tests for high-volume DocTypes and complex queries
- **Use background jobs for heavy operations**: Never block web requests with long-running tasks
- **Log critical operations**: Use `frappe.log_error()` and activity logs for auditability

### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Over-complex workflows | Hard to maintain, user confusion | Keep workflows linear when possible; split complex flows |
| Missing error handling in integrations | Silent failures, data inconsistency | Wrap external calls in try/except; log errors; retry logic |
| Race conditions in document updates | Data corruption | Use `frappe.db.get_value(..., for_update=True)` for locks |
| SLA without timezone handling | Wrong calculations for global users | Store and compare in UTC; use `frappe.utils.convert_utc_to_timezone` |
| Not using queues for bulk operations | Timeouts, memory issues | Use `frappe.enqueue()` for operations on many records |
| Hardcoded role names | Breaks on role changes | Use constants or settings for role names |
| Custom UI patterns | Inconsistent UX, user confusion | Study and follow CRM/Helpdesk app shells |
| Using vanilla JS/jQuery for frontend | Maintenance burden, ecosystem mismatch | Always use Frappe UI with Vue 3 |

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `enterprise-patterns/references/enterprise-patterns.md`.

## Enterprise Patterns (CRM/Helpdesk-style apps)

Production-grade architectural patterns for building enterprise applications like CRM, Helpdesk, HRMS, and similar multi-entity systems.

### Data Model Design

#### Core Entity Structure
- Use clear, normalized DocTypes for core entities (Lead, Contact, Ticket, SLA, Assignment)
- Define explicit relationships via Link fields and Dynamic Links
- Use child tables for activities, comments, timelines, and line items

#### Naming and Identification
- Use `autoname` patterns: `naming_series`, `field:field_name`, or `hash`
- Consider human-readable names for customer-facing entities
- Use hash-based names for high-volume transactional records

#### Example: Helpdesk Data Model
```
Ticket (parent)
├── ticket_type (Link: Ticket Type)
├── customer (Link: Customer)
├── assigned_to (Link: User)
├── status (Select)
├── priority (Link: Priority)
├── sla (Link: SLA)
└── activities (Table: Ticket Activity)
```

### Workflow and State Management

#### State Machines
- Implement state transitions via Workflow DocType or `docstatus` for submission flow
- Use role-based transitions and approval chains
- Define allowed states and transitions explicitly

#### Workflow Patterns
```python
# Check transition validity
def validate_transition(doc, new_status):
    allowed = get_allowed_transitions(doc.status, frappe.session.user)
    if new_status not in allowed:
        frappe.throw(f"Cannot transition from {doc.status} to {new_status}")
```

#### docstatus Usage
| docstatus | Meaning | Use Case |
|-----------|---------|----------|
| 0 | Draft | Editable, not finalized |
| 1 | Submitted | Locked, can cancel |
| 2 | Cancelled | Soft delete, auditable |

### Permissions and Security

#### Row-Level Permissions
- Use User Permissions to restrict access by entity (e.g., only own tickets)
- Combine with Role Permissions for field-level control
- Always re-check in RPC methods:

```python
@frappe.whitelist()
def update_ticket(name, status):
    doc = frappe.get_doc("Ticket", name)
    if not frappe.has_permission("Ticket", "write", doc):
        frappe.throw("Not permitted", frappe.PermissionError)
    doc.status = status
    doc.save()
```

#### Permission Patterns
- Use `has_permission` hook for complex permission logic
- Implement team-based access via intermediate DocTypes
- Cache permission checks for batch operations

### Activity and Audit Trails

#### Communication Log
- Use Comments for internal notes and activity tracking
- Use Communication DocType for customer interactions (email, calls)
- Link activities to parent documents via `reference_doctype` and `reference_name`

#### Audit Trail Implementation
```python
def on_update(doc, method):
    if doc.has_value_changed("status"):
        frappe.get_doc({
            "doctype": "Activity Log",
            "reference_doctype": doc.doctype,
            "reference_name": doc.name,
            "action": "Status Change",
            "data": f"{doc._doc_before_save.status} → {doc.status}"
        }).insert(ignore_permissions=True)
```

#### Key Fields to Track
- Status changes
- Assignment changes
- SLA breaches
- Customer interactions
- Escalations

### SLA Management

#### SLA DocType Structure
```
SLA
├── name
├── entity_type (Link: DocType)
├── conditions (Table: SLA Condition)
├── response_time (Duration)
├── resolution_time (Duration)
└── escalation_rules (Table: Escalation Rule)
```

#### SLA Enforcement
```python
def apply_sla(doc):
    sla = get_applicable_sla(doc)
    if sla:
        doc.response_by = add_to_date(doc.creation, hours=sla.response_time)
        doc.resolution_by = add_to_date(doc.creation, hours=sla.resolution_time)
```

#### SLA Breach Detection
- Use scheduled jobs to check approaching/breached SLAs
- Trigger Notification rules for SLA warnings
- Update breach flags on documents

### Assignment and Queue Management

#### Assignment Patterns
- Use Assignment Rule DocType for automatic assignment
- Implement round-robin or load-balanced distribution
- Track assignment history in child table or Activity Log

#### Queue Implementation
```python
def get_next_agent(queue):
    """Round-robin assignment within a queue"""
    agents = frappe.get_all("Queue Member", 
        filters={"queue": queue, "available": 1},
        fields=["user", "current_load"],
        order_by="current_load asc"
    )
    return agents[0].user if agents else None
```

#### Queue Health Dashboards
- Show queue depth and aging
- Display agent workload distribution
- Track SLA compliance by queue

### Notifications and Escalations

#### Notification Triggers
- SLA approaching breach
- Assignment changes
- Status transitions
- Customer replies
- Escalation events

#### Escalation Chain
```
Level 1: Notify assigned agent
Level 2: Notify team lead (after X hours)
Level 3: Notify manager (after Y hours)
Level 4: Notify department head (after Z hours)
```

#### Implementation
- Use Notification DocType with conditions
- Schedule background jobs for time-based escalations
- Track escalation level on document

### Integration Patterns

#### External System Integration
- Centralize integrations in `integrations/` module
- Use background jobs for sync operations
- Implement retry logic with exponential backoff

#### Common Integrations
| System | Pattern |
|--------|---------|
| Email | Email Account + Communication |
| Telephony | Webhook + Call Log DocType |
| External CRM | REST connector + sync job |
| Chat | Webhook + real-time events |

#### Sync Job Template
```python
def sync_external_tickets():
    """Background job for external ticket sync"""
    last_sync = get_last_sync_timestamp()
    tickets = fetch_external_tickets(since=last_sync)
    
    for ticket in tickets:
        try:
            upsert_ticket(ticket)
        except Exception as e:
            log_sync_error(ticket, e)
    
    update_sync_timestamp()
```

### Reporting and Analytics

#### Operational Reports
| Report | Purpose |
|--------|---------|
| SLA Compliance | Track response/resolution times |
| Backlog Aging | Identify stuck tickets |
| Agent Performance | Tickets resolved, avg resolution time |
| Queue Health | Volume, wait times by queue |

#### Report Implementation
- Use Query Reports for SQL-based reports
- Use Script Reports for complex aggregations
- Build dashboards with Number Cards and Charts

#### Example Query Report
```sql
SELECT
    assigned_to,
    COUNT(*) as total_tickets,
    AVG(TIMESTAMPDIFF(HOUR, creation, resolution_time)) as avg_resolution_hours,
    SUM(CASE WHEN sla_breached = 1 THEN 1 ELSE 0 END) as breached
FROM `tabTicket`
WHERE creation BETWEEN %(from_date)s AND %(to_date)s
GROUP BY assigned_to
```

### Performance Considerations

#### Query Optimization
- Index frequently filtered fields (status, assigned_to, customer)
- Use `frappe.get_list` with specific fields
- Paginate large result sets

#### Caching Strategies
- Cache SLA configurations (change infrequently)
- Cache user permissions for batch operations
- Use Redis for real-time counters

#### Background Processing
- Process bulk operations in background jobs
- Chunk large data migrations
- Use job queues for priority handling

### Templates and Examples

Reference the mini-app-template for implementation examples:
- Service layer: `assets/mini-app-template/your_app/services/`
- Background jobs: `assets/mini-app-template/your_app/background_jobs/`
- API patterns: `assets/mini-app-template/your_app/api.py`

### Sources

- Frappe Framework patterns for enterprise apps
- ERPNext CRM module architecture
- Frappe Helpdesk implementation patterns
