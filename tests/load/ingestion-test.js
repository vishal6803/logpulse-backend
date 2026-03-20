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
      "x-api-key": "lp_proj_0dd5e38c90544ddaaaf75f33cf22d2ba",
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    "status is 200": (r) => r.status === 200,
    "errorGroupId returned": (r) => r.body.includes("errorGroupId"),
  });
}
