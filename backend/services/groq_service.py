import os
import json
import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = "llama-3.3-70b-versatile"


async def _call(messages: list, max_tokens: int = 500, temperature: float = 0.7) -> dict:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "response_format": {"type": "json_object"},
            },
        )
        resp.raise_for_status()
        return json.loads(resp.json()["choices"][0]["message"]["content"])


async def generate_content(topic: str, platform: str, brand_voice: str) -> dict:
    prompt = f"""Generate a {platform} post about: {topic}
Brand voice: {brand_voice}

Return ONLY valid JSON with these keys:
- hook: attention-grabbing opening line (max 50 words)
- body: main content (max 100 words)
- cta: call to action (max 20 words)
- image_description: description for AI image generation (max 30 words, visual scene, no text)"""
    return await _call([
        {"role": "system", "content": "You are a marketing content creator. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ], max_tokens=500, temperature=0.7)


async def analyze_sentiment(message: str) -> dict:
    prompt = f"""Analyze the sentiment of this customer message:
"{message}"

Return ONLY valid JSON with:
- sentiment: float from -1 (very negative) to 1 (very positive)
- confidence: float from 0 to 1
- intent: string (complaint, question, praise, feedback, other)"""
    return await _call([
        {"role": "system", "content": "You are a sentiment analysis expert. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ], max_tokens=200, temperature=0.1)


async def generate_reply(context_or_message, user_message: str = "", brand_voice: str = "", faqs: str = "") -> dict:
    """Generate a reply. Accepts either (context_list, user_message) or (message_str, brand_voice, faqs)."""
    if isinstance(context_or_message, list):
        history = "\n".join(
            f"{m.get('direction','?')}: {m.get('message','')}"
            for m in context_or_message[-10:]
        )
        prompt = f"""Conversation history:
{history}

User's latest message to reply to: {user_message}

Return ONLY valid JSON with:
- reply: the reply text (max 280 characters)"""
    else:
        prompt = f"""Generate a customer reply for this message:
"{context_or_message}"

Brand voice: {brand_voice}
FAQs: {faqs}

Return ONLY valid JSON with:
- reply: the reply text (max 280 characters)"""
    return await _call([
        {"role": "system", "content": "You are a customer service expert. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ], max_tokens=200, temperature=0.5)


async def parse_command(command: str) -> dict:
    prompt = f"""Parse this natural language automation command:
"{command}"

Return ONLY valid JSON with:
- intent: the primary action (e.g. "send_message", "create_post", "update_customer", "schedule_task")
- entities: dict of key entities extracted (e.g. channel, recipient, message, date, platform)
- original_command: the original command string
- confidence: float 0-1"""
    return await _call([
        {"role": "system", "content": "You are a command parser for a marketing automation system. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ], max_tokens=300, temperature=0.2)


async def answer_analytics_question(question: str, context: dict, time_range: str = None) -> dict:
    prompt = f"""Answer this analytics question using the provided data context.

Question: {question}
Time range: {time_range or "all time"}

Data context:
{json.dumps(context, indent=2, default=str)}

Return ONLY valid JSON with:
- answer: string, clear answer to the question
- data: dict with relevant numbers/metrics
- visualization: string, suggested chart type (bar, line, pie, table, or null)
- insights: list of 2-3 actionable insights"""
    return await _call([
        {"role": "system", "content": "You are a marketing analytics expert. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ], max_tokens=800, temperature=0.3)


async def generate_insights(context: dict) -> dict:
    from datetime import datetime
    prompt = f"""Analyze this marketing data and generate insights.

Data:
- Content pieces: {len(context.get('content', []))}
- Customers: {len(context.get('customers', []))}
- Deals: {len(context.get('deals', []))}

Recent content: {json.dumps(context.get('content', [])[:5], default=str)}
Recent customers: {json.dumps(context.get('customers', [])[:5], default=str)}

Return ONLY valid JSON with:
- insights: list of insight strings (3-5 insights)
- recommendations: list of action recommendations (2-3)
- top_metric: string, the most important metric to watch"""
    result = await _call([
        {"role": "system", "content": "You are a marketing strategist. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ], max_tokens=600, temperature=0.4)
    result["generated_at"] = datetime.utcnow().isoformat()
    return result


async def generate_predictions(context: dict, period: str = "next_week") -> dict:
    prompt = f"""Based on this marketing data, predict performance for {period}.

Data summary:
- Content pieces: {len(context.get('content', []))}
- Customers: {len(context.get('customers', []))}
- Deals: {len(context.get('deals', []))}

Return ONLY valid JSON with:
- predictions: list of prediction objects, each with: metric, value, trend (up/down/stable), confidence (0-1)
- period: the period string
- confidence: overall confidence float 0-1"""
    return await _call([
        {"role": "system", "content": "You are a marketing prediction expert. Return only valid JSON."},
        {"role": "user", "content": prompt},
    ], max_tokens=500, temperature=0.3)
