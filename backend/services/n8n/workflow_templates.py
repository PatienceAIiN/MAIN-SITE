"""
Workflow Templates - Predefined n8n workflow template definitions.
"""

from typing import Any


def get_templates() -> list[dict[str, Any]]:
    """
    Return all predefined workflow templates.

    Each template contains:
        - id: Unique template identifier
        - name: Human-readable name
        - description: What the workflow does
        - trigger: What starts the workflow
        - steps: Ordered list of workflow step definitions
        - n8n_config: n8n-specific node configuration hints

    Returns:
        List of workflow template dicts.
    """
    return [
        {
            "id": "new_email_flow",
            "name": "New Email Processing Flow",
            "description": (
                "Processes incoming emails: classifies intent, extracts data, "
                "routes to appropriate handler, and sends auto-response if applicable."
            ),
            "trigger": {
                "type": "email",
                "event": "email.received",
                "config": {"mailbox": "inbox", "filter": "unread"},
            },
            "steps": [
                {
                    "id": "classify",
                    "name": "Classify Email Intent",
                    "action": "ai_classify",
                    "config": {
                        "categories": [
                            "inquiry",
                            "complaint",
                            "purchase_intent",
                            "support",
                            "partnership",
                            "spam",
                        ],
                    },
                },
                {
                    "id": "extract",
                    "name": "Extract Key Information",
                    "action": "ai_extract",
                    "config": {
                        "fields": ["sender_name", "company", "request_type", "urgency"],
                    },
                },
                {
                    "id": "store",
                    "name": "Store in CRM",
                    "action": "store_interaction",
                    "config": {"table": "conversations", "channel": "email"},
                },
                {
                    "id": "respond",
                    "name": "Generate & Send Response",
                    "action": "ai_respond",
                    "config": {"tone": "professional", "max_length": 300},
                },
            ],
            "n8n_config": {
                "nodes": ["EmailTrigger", "Function", "HTTP Request", "Gmail"],
                "webhook_path": "/webhook/new-email",
            },
        },
        {
            "id": "instagram_dm_flow",
            "name": "Instagram DM Auto-Response",
            "description": (
                "Monitors Instagram DMs, generates contextual responses using AI, "
                "and handles common customer queries automatically."
            ),
            "trigger": {
                "type": "social",
                "event": "social.dm",
                "config": {"platform": "instagram"},
            },
            "steps": [
                {
                    "id": "fetch_context",
                    "name": "Fetch Customer Context",
                    "action": "get_customer_context",
                    "config": {"source": "instagram_handle"},
                },
                {
                    "id": "classify",
                    "name": "Classify DM Intent",
                    "action": "ai_classify",
                    "config": {
                        "categories": [
                            "product_question",
                            "order_status",
                            "collaboration",
                            "general",
                        ],
                    },
                },
                {
                    "id": "generate",
                    "name": "Generate Response",
                    "action": "ai_respond",
                    "config": {"tone": "friendly", "max_length": 150, "include_emoji": True},
                },
                {
                    "id": "send",
                    "name": "Send DM Reply",
                    "action": "send_social_message",
                    "config": {"platform": "instagram", "require_approval": False},
                },
            ],
            "n8n_config": {
                "nodes": ["Webhook", "Function", "HTTP Request", "Instagram"],
                "webhook_path": "/webhook/instagram-dm",
            },
        },
        {
            "id": "payment_alert",
            "name": "Payment Alert & Follow-up",
            "description": (
                "Processes payment notifications, updates order status, "
                "sends confirmation emails, and triggers post-purchase nurture."
            ),
            "trigger": {
                "type": "transaction",
                "event": "payment.completed",
                "config": {"providers": ["stripe", "paypal", "razorpay"]},
            },
            "steps": [
                {
                    "id": "validate",
                    "name": "Validate Payment Data",
                    "action": "validate_payment",
                    "config": {"required_fields": ["amount", "currency", "customer_id"]},
                },
                {
                    "id": "update_order",
                    "name": "Update Order Status",
                    "action": "update_record",
                    "config": {"table": "orders", "status": "paid"},
                },
                {
                    "id": "send_confirmation",
                    "name": "Send Confirmation Email",
                    "action": "send_email",
                    "config": {"template": "payment_confirmation"},
                },
                {
                    "id": "start_nurture",
                    "name": "Start Post-Purchase Nurture",
                    "action": "trigger_sequence",
                    "config": {"sequence": "post_purchase", "delay_hours": 24},
                },
            ],
            "n8n_config": {
                "nodes": ["Webhook", "Function", "Supabase", "SendGrid"],
                "webhook_path": "/webhook/payment-alert",
            },
        },
        {
            "id": "reddit_mention_flow",
            "name": "Reddit Brand Mention Monitor",
            "description": (
                "Monitors Reddit for brand mentions, analyzes sentiment, "
                "and alerts the team or auto-responds to relevant posts."
            ),
            "trigger": {
                "type": "social",
                "event": "social.mention",
                "config": {"platform": "reddit", "subreddits": [], "keywords": []},
            },
            "steps": [
                {
                    "id": "analyze",
                    "name": "Analyze Mention Sentiment",
                    "action": "ai_sentiment",
                    "config": {"scale": "positive/neutral/negative"},
                },
                {
                    "id": "assess",
                    "name": "Assess Response Need",
                    "action": "ai_classify",
                    "config": {
                        "categories": [
                            "needs_response",
                            "monitor_only",
                            "urgent",
                            "opportunity",
                        ],
                    },
                },
                {
                    "id": "alert",
                    "name": "Send Team Alert",
                    "action": "send_notification",
                    "config": {"channels": ["slack", "email"], "priority_filter": "urgent"},
                },
                {
                    "id": "draft",
                    "name": "Draft Response",
                    "action": "ai_respond",
                    "config": {
                        "tone": "helpful",
                        "platform_rules": "reddit",
                        "require_approval": True,
                    },
                },
            ],
            "n8n_config": {
                "nodes": ["Schedule Trigger", "HTTP Request", "Function", "Slack"],
                "webhook_path": "/webhook/reddit-mention",
            },
        },
        {
            "id": "lead_followup",
            "name": "Lead Follow-up Sequence",
            "description": (
                "Automated lead nurturing sequence: sends personalized follow-ups "
                "based on lead source, engagement, and scoring."
            ),
            "trigger": {
                "type": "lead",
                "event": "lead.created",
                "config": {"sources": ["form", "chat", "referral", "social"]},
            },
            "steps": [
                {
                    "id": "enrich",
                    "name": "Enrich Lead Data",
                    "action": "enrich_lead",
                    "config": {"providers": ["clearbit", "apollo"], "fields": ["company", "role"]},
                },
                {
                    "id": "score",
                    "name": "Score Lead",
                    "action": "ai_score",
                    "config": {
                        "factors": ["source", "company_size", "engagement", "intent_signals"],
                        "scale": "1-100",
                    },
                },
                {
                    "id": "segment",
                    "name": "Assign Segment",
                    "action": "segment_lead",
                    "config": {
                        "segments": ["hot", "warm", "cold"],
                        "score_thresholds": {"hot": 70, "warm": 40},
                    },
                },
                {
                    "id": "nurture",
                    "name": "Start Nurture Sequence",
                    "action": "trigger_sequence",
                    "config": {
                        "sequences": {
                            "hot": "immediate_followup",
                            "warm": "drip_campaign",
                            "cold": "awareness_series",
                        },
                    },
                },
            ],
            "n8n_config": {
                "nodes": ["Webhook", "Function", "HTTP Request", "Supabase", "SendGrid"],
                "webhook_path": "/webhook/lead-followup",
            },
        },
        {
            "id": "trend_content_generation",
            "name": "Trend-Based Content Generation",
            "description": (
                "Detects trending topics relevant to the brand, generates content "
                "ideas, drafts posts, and queues them for review."
            ),
            "trigger": {
                "type": "automation",
                "event": "schedule.trigger",
                "config": {"cron": "0 8 * * *", "timezone": "UTC"},
            },
            "steps": [
                {
                    "id": "scan_trends",
                    "name": "Scan Trending Topics",
                    "action": "scan_trends",
                    "config": {
                        "sources": ["google_trends", "twitter", "reddit", "news"],
                        "industry_filter": True,
                    },
                },
                {
                    "id": "filter",
                    "name": "Filter Relevant Trends",
                    "action": "ai_filter",
                    "config": {"relevance_threshold": 0.6, "max_topics": 5},
                },
                {
                    "id": "generate",
                    "name": "Generate Content Drafts",
                    "action": "ai_content",
                    "config": {
                        "formats": ["blog_outline", "social_post", "email_snippet"],
                        "tone": "brand_voice",
                    },
                },
                {
                    "id": "queue",
                    "name": "Queue for Review",
                    "action": "queue_content",
                    "config": {
                        "status": "draft",
                        "notify_team": True,
                        "review_deadline_hours": 24,
                    },
                },
            ],
            "n8n_config": {
                "nodes": ["Schedule Trigger", "HTTP Request", "Function", "Supabase", "Slack"],
                "webhook_path": "/webhook/trend-content",
            },
        },
    ]
