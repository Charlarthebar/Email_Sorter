import os
import anthropic
from dotenv import load_dotenv

load_dotenv()

_client = None


def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


CLASSIFY_TOOL = {
    "name": "categorize_email",
    "description": (
        "Assign the email to exactly one of the user's defined categories, "
        "or return 'inbox' if none fit well."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "category": {
                "type": "string",
                "description": (
                    "The exact category name from the list, or the string 'inbox' "
                    "if no category is a good fit."
                ),
            },
            "reasoning": {
                "type": "string",
                "description": "One sentence explaining why this category was chosen.",
            },
        },
        "required": ["category", "reasoning"],
    },
}

SYSTEM_PROMPT = (
    "You are an email classifier. Given an email and a list of user-defined categories, "
    "assign the email to the single best-matching category. Base your decision on the "
    "overall meaning and intent of the email, not just specific keywords. "
    "If no category is a reasonable fit, return 'inbox'. "
    "Be decisive — always pick the most relevant category when there is a reasonable match."
)


def classify_email(email: dict, categories: list[dict]) -> dict:
    """
    email: {"sender": str, "subject": str, "body": str}
    categories: [{"name": str, "description": str}, ...]
    returns: {"category": str, "reasoning": str}
    """
    category_list = "\n".join(
        f"- {c['name']}: {c['description']}" for c in categories
    )

    user_message = (
        f"Categories:\n{category_list}\n\n"
        f"Email to classify:\n"
        f"From: {email.get('sender', '')}\n"
        f"Subject: {email.get('subject', '')}\n"
        f"Body:\n{email.get('body', '')[:3000]}"
    )

    response = get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
        tools=[CLASSIFY_TOOL],
        tool_choice={"type": "tool", "name": "categorize_email"},
    )

    for block in response.content:
        if block.type == "tool_use":
            return block.input

    return {"category": "inbox", "reasoning": "Classification failed."}
