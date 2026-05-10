from .channels import router as channels_router
from .crm import router as crm_router
from .automation import router as automation_router
from .knowledge import router as knowledge_router
from .analytics import router as analytics_router
from .escalations import router as escalations_router
from .webhooks import router as webhooks_router

__all__ = [
    "channels_router",
    "crm_router",
    "automation_router",
    "knowledge_router",
    "analytics_router",
    "escalations_router",
    "webhooks_router",
]
