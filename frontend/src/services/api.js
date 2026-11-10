const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/v1"
).replace(/\/$/, "");

async function apiRequest(url, options = {}) {
  let response;

  try {
    const token = localStorage.getItem("insight-auth-token");
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error(
      "Cannot connect to the INSIGHT AI backend. Check that the backend server is running."
    );
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail =
      typeof data === "object" && data !== null
        ? data.detail
        : data;

    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed with status ${response.status}.`
    );
  }

  return data;
}

function jsonOptions(body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// DATASET

export async function uploadDataset(file) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest(`${API_BASE_URL}/datasets/upload`, {
    method: "POST",
    body: formData,
  });
}

export async function getDatasetProfile(datasetId) {
  return apiRequest(`${API_BASE_URL}/datasets/${datasetId}/profile`);
}

export async function getDatasetRows(datasetId, page = 1, pageSize = 25, search = "") {
  const params = new URLSearchParams({ page, page_size: pageSize });
  if (search) params.set("search", search);
  return apiRequest(`${API_BASE_URL}/datasets/${datasetId}/rows?${params}`);
}

// CLEANING

export async function getCleaningPreview(datasetId) {
  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/cleaning/preview`
  );
}

export async function applyCleaning(datasetId, options = {}) {
  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/cleaning/apply`,
    jsonOptions(options)
  );
}

export async function downloadCleanedDataset(datasetId) {
  const token = localStorage.getItem("insight-auth-token");
  const response = await fetch(
    `${API_BASE_URL}/datasets/${datasetId}/cleaning/download`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  );

  if (!response.ok) {
    let message = "Could not download cleaned dataset.";
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep the fallback message.
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${datasetId}_cleaned.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
}

// ANALYTICS

export async function getAnalyticsOverview(datasetId, source = "original") {
  const params = new URLSearchParams({ source });
  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/analytics/overview?${params}`
  );
}

export async function getAnalyticsBreakdown(
  datasetId,
  groupBy,
  metric = null,
  aggregation = "sum",
  source = "original"
) {
  const params = new URLSearchParams({
    group_by: groupBy,
    aggregation,
    source,
  });

  if (metric) params.set("metric", metric);

  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/analytics/breakdown?${params}`
  );
}

export async function getAnalyticsTrend(
  datasetId,
  dateColumn,
  metric,
  frequency = "month",
  source = "original"
) {
  const params = new URLSearchParams({
    date_column: dateColumn,
    metric,
    frequency,
    source,
  });

  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/analytics/trend?${params}`
  );
}

export async function getAnalyticsCorrelations(
  datasetId,
  source = "original"
) {
  const params = new URLSearchParams({ source });

  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/analytics/correlations?${params}`
  );
}


export async function indexDataset(datasetId) {
  const job = await apiRequest(`${API_BASE_URL}/datasets/${datasetId}/rag/index-async`, { method: "POST" });
  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const status = await apiRequest(`${API_BASE_URL}/datasets/${datasetId}/rag/jobs/${job.job_id}`);
    if (status.status === "completed") return status.result;
    if (status.status === "failed") throw new Error(status.error || "AI knowledge indexing failed.");
  }
  throw new Error("AI knowledge indexing is still running. You can continue using analytics while it finishes.");
}

// AI ANALYST

export async function askAnalyst(datasetId, question) {
  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/analyst/ask`,
    jsonOptions({ question })
  );
}

// DECISION ENGINE

export async function getDecisionReport(datasetId, source = "original") {
  const params = new URLSearchParams({ source });

  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/decision/report?${params}`
  );
}

// PREDICTIVE INTELLIGENCE

export async function trainPredictiveModel(
  datasetId,
  targetColumn,
  task = "regression",
  source = "original"
) {
  const params = new URLSearchParams({
    target_column: targetColumn,
    task,
    source,
  });

  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/predictive/train?${params}`,
    { method: "POST" }
  );
}

export async function predictWithSavedModel(datasetId, records) {
  return apiRequest(
    `${API_BASE_URL}/datasets/${datasetId}/predictive/predict`,
    jsonOptions({ records })
  );
}

// FORECASTING & INVENTORY
export async function createForecast(datasetId, payload) {
  return apiRequest(`${API_BASE_URL}/datasets/${datasetId}/forecast`, jsonOptions(payload));
}

export async function getForecastSegments(datasetId, options) {
  const params = new URLSearchParams(options);
  return apiRequest(`${API_BASE_URL}/datasets/${datasetId}/forecast/segments?${params}`);
}

// AUTHENTICATION AND REPORT PORTALS
export async function adminLogin(email, password) {
  return apiRequest(`${API_BASE_URL}/auth/admin-login`, jsonOptions({ email, password }));
}

export async function viewerSignup(name, email, password, accessCode) {
  return apiRequest(`${API_BASE_URL}/auth/viewer-signup`, jsonOptions({ name, email, password, access_code: accessCode }));
}

export async function viewerLogin(email, password) {
  return apiRequest(`${API_BASE_URL}/auth/viewer-login`, jsonOptions({ email, password }));
}

export async function getCurrentUser() {
  return apiRequest(`${API_BASE_URL}/auth/me`);
}

export async function previewBusinessReport(datasetId, source = "auto") {
  return apiRequest(`${API_BASE_URL}/admin/reports/preview/${encodeURIComponent(datasetId)}?source=${source}`);
}

export async function publishReport(datasetId, title, source = "original") {
  return apiRequest(`${API_BASE_URL}/admin/reports/publish`, jsonOptions({ dataset_id: datasetId, title, source, expires_days: 30 }));
}

export async function getViewerReports() {
  return apiRequest(`${API_BASE_URL}/viewer/reports`);
}

export async function getViewerReport(reportId) {
  return apiRequest(`${API_BASE_URL}/viewer/reports/${encodeURIComponent(reportId)}`);
}

export async function askViewerReport(reportId, question) {
  return apiRequest(`${API_BASE_URL}/viewer/reports/${encodeURIComponent(reportId)}/chat`, jsonOptions({ question }));
}


export async function getViewerPreferences() {
  return apiRequest(`${API_BASE_URL}/viewer/preferences`);
}

export async function saveViewerPreferences(preferences) {
  return apiRequest(`${API_BASE_URL}/viewer/preferences`, jsonOptions({ preferences }));
}
