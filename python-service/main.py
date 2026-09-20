from fastapi import FastAPI

app = FastAPI(title="Python Specialized Service", version="1.0")

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "python-fastapi"}

@app.get("/")
def read_root():
    return {"message": "Servicio FastAPI conectado correctamente con la arquitectura de Ingeniería Web"}