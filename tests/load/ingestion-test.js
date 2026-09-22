import http from "k6/http";
import { check } from "k6";

export const options = {
  scenarios: {
    ingestion_rps_test: {
      executor: "constant-arrival-rate",
      rate: 300, // 100 requests per second
      timeUnit: "1s",
      duration: "30s", // run test for 30 seconds
      preAllocatedVUs: 50,
      maxVUs: 300,
    },
  },
};

export default function () {
  const url = "http://localhost:3000/api/v1/ingest";

  const payload = JSON.stringify({
    environmentName: "Production",
    type: "TypeError",
    level: "error",
    message: "k6 Load Test Error - Cannot read property 'id' of null",
    // message: `error ${Math.random()}`,
    stack_trace: "at App.js line 42 \n at React.render",
    metadata: {
      browser: "Chrome",
      load_test: true,
    },
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      "x-api-key": __ENV.API_KEY || "lp_proj_81939e25278eba5d2baa4357c4415733",
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    "status is 202": (r) => r.status === 202,
    "event queued": (r) => r.body.includes("queued"),
  });
}
