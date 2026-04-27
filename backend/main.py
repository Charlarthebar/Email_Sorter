from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import classifier

app = FastAPI(title="AI Email Sorter API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # lock this down if you deploy publicly
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


class Category(BaseModel):
    name: str
    description: str


class EmailData(BaseModel):
    sender: str
    subject: str
    body: str


class ClassifyRequest(BaseModel):
    email: EmailData
    categories: list[Category]


class ClassifyResponse(BaseModel):
    category: str
    reasoning: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/classify", response_model=ClassifyResponse)
def classify(request: ClassifyRequest):
    if not request.categories:
        return ClassifyResponse(category="inbox", reasoning="No categories configured.")

    try:
        result = classifier.classify_email(
            request.email.model_dump(),
            [c.model_dump() for c in request.categories],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return ClassifyResponse(**result)
