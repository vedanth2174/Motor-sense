# 🧠 MotorSense — Machine Learning & Generative AI Architecture

This document provides a comprehensive technical breakdown of the machine learning algorithms, generative diagnostics, and planned artificial intelligence roadmap powering the **MotorSense** industrial predictive maintenance platform.

---

## 🏛️ The 3-Layer Hybrid Intelligence Model

MotorSense avoids the pitfalls of relying solely on black-box ML or rigid physical rules by implementing a **3-Layer Hybrid Detection Pipeline**:

```
                         ┌────────────────────────────────────────────────────────┐
                         │              High-Frequency Sensor Stream              │
                         │   [Voltage, Current, Temp, Humidity, Vibration]        │
                         └──────────────────────────┬─────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Deterministic Physics Rules (Microsecond Execution)                                                    │
│ Checks instantaneous electrical and mechanical safety boundaries (Overcurrent >110%, ISO 10816 Vibration >4.5).  │
│ Outcome: Instant CRITICAL trip if physical safety thresholds are violated.                                      │
└───────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Layer 2: Statistical Isolation Forest Baseline (Multi-Dimensional Correlation)                                  │
│ Unsupervised ML model trained on 500+ healthy motor cycles. Quantifies subtle multi-sensor drift and wear.     │
│ Outcome: Anomaly Score (s <= 0 flags subtle degradation -> WARNING state).                                      │
└───────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Layer 3: Generative AI Engineering Diagnostics (Contextual Reasoning)                                           │
│ LLM synthesizes telemetry window trends + active alerts + motor asset ratings + past maintenance history.       │
│ Outcome: Root-cause identification, fault severity rating, and step-by-step repair guidance.                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Layer 2: Statistical Isolation Forest Machine Learning

### 1. Why Isolation Forest Over Supervised Classifiers?
* **Extreme Class Imbalance:** In industrial settings, AC induction motors operate normally **>99% of their lifespan**. True failure data is virtually non-existent during initial deployment.
* **Zero Failure Data Required:** Traditional supervised models (XGBoost, Random Forests, Neural Networks) require thousands of labeled failure cases. **Isolation Forest is completely unsupervised**—it only needs to learn what *healthy baseline operation* looks like.
* **Efficiency:** $\mathcal{O}(n \log n)$ time complexity and minimal memory footprint, making it suitable for high-frequency continuous telemetry scoring.

---

### 2. Algorithmic Intuition & Mathematics

The algorithm constructs an ensemble of $T = 100$ isolation trees (`n_estimators=100`).

```
                    [ 5-Dimensional Space: V, I, T, H, Vib ]
                                      │
                             Random Feature: Current
                                 Split at 6.8A
                                 /          \
                          < 6.8A              >= 6.8A
                           /                     \
                  Split: Temp < 52°?       [ANOMALOUS DATA POINT]
                     /          \          Isolated in only 1-2 splits!
             [Normal Cluster]   ...        (Sparse outer boundary)
           Deep tree path length
```

* **Nominal Points:** Reside in dense clusters within the 5D feature space. Isolating a single normal point requires many recursive partitions (deep average path length $h(x)$).
* **Anomalies / Drift:** Reside in sparse peripheral regions. They are isolated very quickly with few random cuts (short path length $h(x)$).

#### Anomaly Score Formula:
The anomaly score $s(x, n)$ for an observation $x$ over a dataset of $n$ instances is:

$$s(x, n) = 2^{-\frac{\mathbb{E}(h(x))}{c(n)}}$$

Where $c(n)$ is the average path length of unsuccessful searches in a Binary Search Tree:

$$c(n) = 2 \ln(n - 1) + 0.5772156649\text{ (Euler-Mascheroni constant)} - \frac{2(n - 1)}{n}$$

* **$s \approx 1$:** High probability of anomaly.
* **$s < 0.5$:** Definitely normal.
* In Scikit-Learn's `decision_function`, the output is centered such that:
  * **Score $> 0$:** Nominal operation (`SAFE`).
  * **Score $\le 0$:** Statistical anomaly (`WARNING`).

---

### 3. Feature Engineering (5-Dimensional Telemetry Vector)

Every incoming sensor reading is projected into a 5D vector:
$$\vec{x} = \begin{bmatrix} \text{temperature} \\ \text{humidity} \\ \text{current} \\ \text{voltage} \\ \text{vibration} \end{bmatrix} \in \mathbb{R}^5$$

#### Why Multi-Dimensional Correlation Matters:
Consider a scenario where:
* Current $= 7.8\text{A}$ *(Normal, below 8.5A limit)*
* Temperature $= 62^\circ\text{C}$ *(Normal, below 80°C limit)*
* Vibration $= 2.9\,\text{mm/s}$ *(Normal, below 4.5 mm/s limit)*

Individually, **zero single-sensor threshold rules are tripped**. However, having high current accompanied by elevated thermal build-up and moderate vibration at nominal voltage indicates rotor resistance increase or bearing cage friction. **The Isolation Forest flags this subtle joint correlation before physical damage occurs.**

---

### 4. Training Pipeline & Model Governance (`training.py`)

1. **Data Ingestion & Hygiene:** Extracts continuous readings where all 5 features are non-null and physically plausible (`is_valid = True`).
2. **Human-in-the-Loop Approval:** The platform requires an engineer to inspect baseline statistics and click **"Approve Baseline"** in the UI to ensure training data was captured during certified normal operation.
3. **Hyperparameters:**
   * `n_estimators = 100` (balance between stability and latency)
   * `contamination = 0.03` (allows 3% natural noise in normal operation)
   * `random_state = 42` (reproducibility)
4. **Artifact Versioning:** Models are serialized to `/models/<machine_id>/v_YYYYMMDD_HHMMSS.joblib` and tracked in PostgreSQL (`MachineBaseline` table).

---

## 💡 Layer 3: Generative AI Diagnostics (`services/llm/`)

When anomalies or faults are detected, the system passes structured telemetry to a Large Language Model to act as an on-call mechanical & electrical reliability engineer.

### 1. Telemetry Window Summarization (`prompts.py`)
Rather than overwhelming the LLM with thousands of raw points, the backend computes a **compact window summary** over the last 30–60 minutes:
* **Per-sensor metrics:** Min, Mean, Max, Latest value, and Slope Trend (`rising`, `stable`, `falling`).
* **Active Alerts:** List of tripped Layer 1 rules and Layer 2 anomaly events.
* **Asset Specifications:** Motor rated voltage, rated current, max thermal limit, and location.
* **Maintenance History:** Last 3 completed service interventions.

---

### 2. Multi-Provider Architecture (`providers.py`)
The platform supports 3 interchangeable LLM execution backends:

| Provider | Configuration (`LLM_PROVIDER`) | Execution Environment | Best For |
|---|---|---|---|
| **Ollama** | `ollama` | Local offline server (`http://host.docker.internal:11434`) | Air-gapped factory plants with strict data privacy |
| **OpenRouter / OpenAI** | `openrouter` / `openai` | Cloud API (`https://openrouter.ai/api/v1`) | Cutting-edge frontier reasoning (Claude 3.5, GPT-4o) |
| **Fallback Engine** | `none` | Zero-dependency deterministic Python heuristics | Default out-of-the-box local testing without GPU/APIs |

---

### 3. Structured JSON Diagnostic Schema
The LLM response is strictly enforced to match this engineering schema:

```json
{
  "summary": "Elevated phase current (10.8A) accompanied by rapid temperature slope indicates mechanical overload or rotor bar degradation.",
  "likely_causes": [
    "Driven mechanical load stall or jamming in production conveyor line",
    "Bearing raceway flaking causing abnormal rotor drag",
    "Stator winding turn-to-turn insulation breakdown"
  ],
  "severity": "high",
  "recommended_actions": [
    "Immediately decouple motor from mechanical load and perform manual shaft spin test",
    "Execute thermal imaging scan on terminal box and drive-end bearing housing",
    "Perform insulation resistance (Megger) test between phases and to ground"
  ],
  "confidence": "high"
}
```

---

## 🔮 Planned AI Features & Future Roadmap

The following advanced machine learning and AI capabilities are designed for upcoming platform releases:

---

### 1. Remaining Useful Life (RUL) & Time-to-Failure Forecasting
* **Objective:** Move from *anomaly detection* ("something is wrong right now") to *prognostics* ("the drive-end bearing will reach critical vibration failure in 72 operating hours").
* **Proposed Architecture:**
  * **Model:** Deep sequence models like **Temporal Fusion Transformers (TFT)** or **N-BEATS**.
  * **Degradation Indicator (Health Index):** Composite health indicator derived from vibration RMS and thermal slope.
  * **Target Output:** Survival curves and $95\%$ confidence bounds on remaining operational hours before reaching ISO 10816 critical boundary ($4.5\,\text{mm/s}^2$).

```
100% ──── Nominal Health
          \
           \
            \────── Degradation Trend (LSTM / TFT)
                     \
                      \───── RUL Threshold (4.5 mm/s²)
                             │
                             ▼
                    "Failure in 68 hours"
```

---

### 2. RAG-Powered OEM Knowledge Retrieval (Manuals & Standards)
* **Objective:** Ground the LLM's diagnostic recommendations in official OEM manuals, bearing catalogs, and IEEE/ISO electrical standards.
* **Implementation Plan:**
  * Index motor manuals (Siemens, ABB, WEG) and bearing engineering tables (SKF, Timken) using **pgvector** inside the existing PostgreSQL container.
  * When an alert trips, retrieve the exact torque specifications, bearing lubricant viscosity ratings, and manufacturer troubleshooting charts.
  * **Benefit:** Eliminates generic advice; tells the technician the exact grease type (e.g. *Polyurea grease with base oil viscosity 100 cSt at 40°C*) and bolt torque (e.g. *35 Nm*).

---

### 3. High-Frequency Acoustic & Vibration FFT Analysis (TinyML Edge)
* **Objective:** Detect ultra-early subsurface bearing defects that show up in acoustic emission frequencies ($>10\,\text{kHz}$) long before standard mechanical vibration spikes.
* **Implementation Plan:**
  * Compute Fast Fourier Transform (FFT) on ESP32 or gateway.
  * Extract defect characteristic frequencies:
    * **BPFO:** Ball Pass Frequency Outer race
    * **BPFI:** Ball Pass Frequency Inner race
    * **BSF:** Ball Spin Frequency
    * **FTF:** Fundamental Train Frequency (cage defect)
  * Classify frequency peaks using a lightweight **1D-Convolutional Neural Network (1D-CNN)** running directly on ESP32 via **TensorFlow Lite for Microcontrollers**.

---

### 4. Autonomous CMMS / ERP Work-Order Drafting
* **Objective:** Zero-touch integration between AI diagnostics and factory maintenance software.
* **Implementation Plan:**
  * When an alert is validated by an engineer, the AI automatically drafts a complete work order.
  * Webhook integrations with enterprise systems: **SAP Plant Maintenance (PM)**, **IBM Maximo**, and **Jira Service Management**.
  * Includes automated parts requisition (e.g., *SKF 6205-2Z bearing + shaft seal ring*).

---

### 5. Fleet-Wide Federated / Transfer Learning
* **Objective:** Allow a newly commissioned motor to have an instant ML anomaly model on Day 1 without waiting 500 samples.
* **Implementation Plan:**
  * Normalize telemetry by motor rated values:
    $$I_{\text{norm}} = \frac{I}{I_{\text{rated}}}, \quad V_{\text{norm}} = \frac{V}{V_{\text{nominal}}}, \quad T_{\text{norm}} = \frac{T}{T_{\text{max}}}$$
  * Train a universal base model across an entire fleet of AC induction motors, then fine-tune slightly for individual installation quirks.

---

## 📊 Summary of AI/ML Capabilities

| Capability | Current State (v2.1) | Next Release (v2.2+) | Long-Term Vision (v3.0) |
|---|---|---|---|
| **Anomaly Detection** | Unsupervised Isolation Forest (5D vector) | Autoencoder Neural Net + Dynamic Baselines | Real-time Edge TinyML inference on ESP32 |
| **Diagnostics** | Structured LLM Narrative (Ollama/OpenRouter) | RAG on OEM manuals + Bearing tables | Autonomous multi-agent root-cause debate |
| **Prognostics** | Statistical rule & anomaly scoring | Trend extrapolation | Remaining Useful Life (RUL) with TFT |
| **Sensor Modalities** | 5 core physical sensors (V, I, T, H, Vib) | + Vibration FFT Spectral Peaks | + Ultrasonic & Motor Current Signature (MCSA) |
| **Workflows** | In-app alerts & manual acknowledgement | One-click work order export | Automated SAP PM / IBM Maximo dispatch |
