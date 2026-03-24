# LogPulse Backend

LogPulse Backend is a high-throughput event ingestion system designed to collect, process, and aggregate application logs and errors efficiently.

It demonstrates real-world backend architecture concepts such as batching, contention handling, and scalable ingestion pipelines.

---

## 🚀 Features

- High-throughput event ingestion API
- Error grouping using fingerprinting
- Batched database writes to reduce contention
- PostgreSQL-based storage
- Load-tested using k6 (~300 RPS on local system)
- Designed for future queue-based scaling (Redis)

---

## 🧠 Architecture

### Current Flow (Batched System)

Client → Express API → In-Memory Buffer → Batch Processor → PostgreSQL

### Key Design Decisions

- **Batching** reduces row-level contention in PostgreSQL
- **Error grouping** prevents duplicate storage of identical errors
- **Asynchronous flushing** improves throughput and latency

---

## 📦 Tech Stack

- Node.js
- Express.js
- PostgreSQL
- TypeScript
- k6 (load testing)

---

## 📁 Project Structure
# LogPulse Backend

LogPulse Backend is a high-throughput event ingestion system designed to collect, process, and aggregate application logs and errors efficiently.

It demonstrates real-world backend architecture concepts such as batching, contention handling, and scalable ingestion pipelines.

---

## 🚀 Features

- High-throughput event ingestion API
- Error grouping using fingerprinting
- Batched database writes to reduce contention
- PostgreSQL-based storage
- Load-tested using k6 (~300 RPS on local system)
- Designed for future queue-based scaling (Redis)

---

## 🧠 Architecture

### Current Flow (Batched System)

Client → Express API → In-Memory Buffer → Batch Processor → PostgreSQL

### Key Design Decisions

- **Batching** reduces row-level contention in PostgreSQL
- **Error grouping** prevents duplicate storage of identical errors
- **Asynchronous flushing** improves throughput and latency

---

## 📦 Tech Stack

- Node.js
- Express.js
- PostgreSQL
- TypeScript
- k6 (load testing)

---

## 📁 Project Structure
src/
├── api/
│ ├── controllers/
│ ├── routes/
│
├── worker/
│ ├── batchProcessor.ts
│ ├── worker.ts
│
├── config/
│ ├── db.ts
│ ├── redis.ts (planned)
│
├── utils/
└── app.ts

tests/
└── load/


---

## ⚙️ How It Works

### 1. Ingestion API

- Accepts log/error payloads
- Stores data in in-memory buffer
- Returns response immediately

---

### 2. Fingerprinting

Each event generates a fingerprint:

Used to:

- group identical errors
- maintain occurrence count

---

### 3. Batch Processing

- Events are aggregated in memory
- Every 1–2 seconds:
  - Bulk UPSERT into `error_groups`
  - Bulk INSERT into `events`

---

## 🗄️ Database Schema (Simplified)

### error_groups

- id
- project_id
- environment_id
- fingerprint (UNIQUE)
- message
- occurrence_count
- last_seen

---

### events

- id
- project_id
- environment_id
- error_group_id
- type
- level
- message
- stack_trace
- metadata
- created_at

---

## 📊 Performance Testing

Load tested using k6 with constant RPS.

### Results

| RPS | Avg Latency | p95 | Max Latency | Notes |
|-----|------------|-----|-------------|------|
| 100 | ~11ms | ~39ms | ~560ms | Stable |
| 300 | ~43ms | ~211ms | ~786ms | Throughput limit begins |

---

## 🔍 Key Learnings

- Row-level locking is a major scalability bottleneck
- Batching significantly reduces contention
- Removing one bottleneck exposes the next
- Latency percentiles (p95/max) matter more than averages
- Systems must handle worst-case patterns (error spikes)

---

## ⚠️ Current Limitations

- In-memory batching (risk of data loss on crash)
- Burst writes during flush
- No queue (Redis not implemented yet)
- Single-node system

---

## 🛣️ Future Improvements

- Redis-based queue (decouple ingestion from processing)
- Worker-based processing pipeline
- Bulk insert optimization
- Rate limiting & backpressure handling
- Frontend dashboard integration

---

## 🧪 Running Locally

### 1. Install dependencies

Used to:

- group identical errors
- maintain occurrence count

---

### 3. Batch Processing

- Events are aggregated in memory
- Every 1–2 seconds:
  - Bulk UPSERT into `error_groups`
  - Bulk INSERT into `events`

---

## 🗄️ Database Schema (Simplified)

### error_groups

- id
- project_id
- environment_id
- fingerprint (UNIQUE)
- message
- occurrence_count
- last_seen

---

### events

- id
- project_id
- environment_id
- error_group_id
- type
- level
- message
- stack_trace
- metadata
- created_at

---

## 📊 Performance Testing

Load tested using k6 with constant RPS.

### Results

| RPS | Avg Latency | p95 | Max Latency | Notes |
|-----|------------|-----|-------------|------|
| 100 | ~11ms | ~39ms | ~560ms | Stable |
| 300 | ~43ms | ~211ms | ~786ms | Throughput limit begins |

---

## 🔍 Key Learnings

- Row-level locking is a major scalability bottleneck
- Batching significantly reduces contention
- Removing one bottleneck exposes the next
- Latency percentiles (p95/max) matter more than averages
- Systems must handle worst-case patterns (error spikes)

---

## ⚠️ Current Limitations

- In-memory batching (risk of data loss on crash)
- Burst writes during flush
- No queue (Redis not implemented yet)
- Single-node system

---

## 🛣️ Future Improvements

- Redis-based queue (decouple ingestion from processing)
- Worker-based processing pipeline
- Bulk insert optimization
- Rate limiting & backpressure handling
- Frontend dashboard integration

---

## 🧪 Running Locally

### 1. Install dependencies

### 2. Setup environment variables

### 3. Run server

### 4. Run load test


---

## 🎯 Project Goal

This project is built to understand:

- how backend systems scale
- how bottlenecks emerge under load
- how real-world systems evolve (naive → optimized → distributed)

---

## ⭐ Summary

Naive → Contention → Batching → Throughput Limit → Queue-Based System (next step)

---

## 📌 Author

Backend-focused project built to explore system design, performance, and scalability.
