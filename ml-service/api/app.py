from flask import Flask
from flask_cors import CORS
from api.routes import bp
import config

app = Flask(__name__)
CORS(app, origins="*")

app.register_blueprint(bp)


@app.route("/health")
def health():
    return {"status": "ok", "service": "examflow-ml"}


if __name__ == "__main__":
    print(f"✅ ML Service starting on port {config.ML_PORT}")
    app.run(host="0.0.0.0", port=config.ML_PORT, debug=False)
