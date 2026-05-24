import axios from 'axios';
import type { UserResponse } from '../types/auth';
import type { Notification } from '../types/notifications';
import type { SyncedBatch, SyncedDpiRecord, SyncedSubjectScore, SyncStatus, SyncTriggerResponse } from '../types/sync';
import type { BatchStream, SMEAssignment, StreamCreate, StreamSuggestion, StreamTemplate, StreamTemplateDetail, SubjectWeight, WeightProposal, WeightsSet } from '../types/streams';
import type { SpringBootBatch } from '../types/batch_management';
import type { AllocationAIRecommendation, AllocationConfig, AllocationRunResult, SMEAssociateRequest, TraineeAllocation } from '../types/allocation';
import type {
  BRCreate,
  BRResponse,
  BRSummary,
  BRUpdate,
  ExcelImportResult,
} from '../types/business_requirements';
import type { ScoresUploadResult, StreamReference } from '../types/scores_upload';
import type { DashboardStats } from '../types/dashboard';

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export const api = axios.create({ baseURL: BASE_URL });

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Transparent token refresh on 401
let isRefreshing = false;
let waitQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function drainQueue(error: unknown, token?: string) {
  waitQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  waitQueue = [];
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status !== 401 || original._retry) return Promise.reject(error);

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        waitQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) { clearAuthAndRedirect(); return Promise.reject(error); }

    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      drainQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (e) {
      drainQueue(e);
      clearAuthAndRedirect();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

function clearAuthAndRedirect() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  window.location.replace('/login');
}

// ---------- API helpers ----------

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string }>('/auth/login', { email, password }),

  me: () => api.get<UserResponse>('/auth/me'),

  register: (email: string, password: string, role: string) =>
    api.post<UserResponse>('/auth/register', { email, password, role }),

  users: () => api.get<UserResponse[]>('/auth/users'),

  deactivateUser: (id: number) =>
    api.patch<UserResponse>(`/auth/users/${id}/deactivate`),
};

export const streamsApi = {
  list:            (batchName: string) =>
                     api.get<BatchStream[]>(`/batches/${encodeURIComponent(batchName)}/streams`),
  create:          (batchName: string, body: StreamCreate) =>
                     api.post<BatchStream>(`/batches/${encodeURIComponent(batchName)}/streams`, body),
  rename:          (batchName: string, streamId: number, body: StreamCreate) =>
                     api.put<BatchStream>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}`, body),
  remove:          (batchName: string, streamId: number) =>
                     api.delete(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}`),
  setPriority:     (batchName: string, streamId: number, priority: number) =>
                     api.patch<BatchStream>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/priority`, { priority }),
  reorder:         (batchName: string, streamIds: number[]) =>
                     api.post<BatchStream[]>(`/batches/${encodeURIComponent(batchName)}/streams/reorder`, { stream_ids: streamIds }),
  setTraineePct:   (batchName: string, streamId: number, trainee_pct: number) =>
                     api.patch<BatchStream>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/trainee-pct`, { trainee_pct }),
  setWeights:      (batchName: string, streamId: number, body: WeightsSet) =>
                     api.post<BatchStream>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/weights`, body),
  listProposals:   (batchName: string, streamId: number) =>
                     api.get<WeightProposal[]>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/proposals`),
  approveProposal: (batchName: string, streamId: number, proposalId: number) =>
                     api.post<WeightProposal>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/proposals/${proposalId}/approve`),
  rejectProposal:  (batchName: string, streamId: number, proposalId: number, body: { rejection_reason?: string }) =>
                     api.post<WeightProposal>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/proposals/${proposalId}/reject`, body),

  listStreamSmes:       (batchName: string, streamId: number) =>
                          api.get<SMEAssignment[]>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/smes`),
  listBatchSmes:        (batchName: string) =>
                          api.get<SMEAssignment[]>(`/batches/${encodeURIComponent(batchName)}/smes`),
  myBatchSmeAssignments:(batchName: string) =>
                          api.get<number[]>(`/batches/${encodeURIComponent(batchName)}/my-sme-assignments`),
  assignSme:            (batchName: string, streamId: number, userId: number) =>
                          api.post<SMEAssignment>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/smes`, { user_id: userId }),
  removeSme:            (batchName: string, streamId: number, userId: number) =>
                          api.delete(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/smes/${userId}`),
};

export const aiSuggestionsApi = {
  generate: (batchName: string, body: { business_context?: string }) =>
    api.post<StreamSuggestion[]>(`/batches/${encodeURIComponent(batchName)}/ai-suggestions/generate`, body),
  list: (batchName: string) =>
    api.get<StreamSuggestion[]>(`/batches/${encodeURIComponent(batchName)}/ai-suggestions`),
  accept: (batchName: string, suggestionId: number) =>
    api.post<StreamSuggestion>(`/batches/${encodeURIComponent(batchName)}/ai-suggestions/${suggestionId}/accept`),
  ignore: (batchName: string, suggestionId: number) =>
    api.post<StreamSuggestion>(`/batches/${encodeURIComponent(batchName)}/ai-suggestions/${suggestionId}/ignore`),
};

export const brApi = {
  list: (batchName?: string) =>
    api.get<BRSummary[]>('/business-requirements', {
      params: batchName ? { batch_name: batchName } : undefined,
    }),
  get: (id: number) =>
    api.get<BRResponse>(`/business-requirements/${id}`),
  create: (body: BRCreate) =>
    api.post<BRResponse>('/business-requirements', body),
  update: (id: number, body: BRUpdate) =>
    api.put<BRResponse>(`/business-requirements/${id}`, body),
  remove: (id: number) =>
    api.delete(`/business-requirements/${id}`),
  downloadTemplate: () =>
    api.get<Blob>('/business-requirements/excel-template', { responseType: 'blob' }),
  parseExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<ExcelImportResult>('/business-requirements/parse-excel', form);
  },
};

export const streamTemplatesApi = {
  list:        () => api.get<StreamTemplate[]>('/streams'),
  get:         (id: number) => api.get<StreamTemplateDetail>(`/streams/${id}`),
  create:      (body: { name: string; description?: string; is_mandatory: boolean; intake_pct: number }) =>
                 api.post<StreamTemplate>('/streams', body),
  update:      (id: number, body: Partial<Pick<StreamTemplate, 'name' | 'description' | 'is_mandatory' | 'intake_pct' | 'is_active'>>) =>
                 api.put<StreamTemplate>(`/streams/${id}`, body),
  remove:      (id: number) => api.delete(`/streams/${id}`),
  getSubjects: (id: number) => api.get<SubjectWeight[]>(`/streams/${id}/subjects`),
  setSubjects: (id: number, body: { subject_name: string; weight_pct: number }[]) =>
                 api.post<SubjectWeight[]>(`/streams/${id}/subjects`, body),
};

export const batchManagementApi = {
  list:   () =>
            api.get<SpringBootBatch[]>('/batch-management'),
  get:    (batchName: string) =>
            api.get<SpringBootBatch>(`/batch-management/${encodeURIComponent(batchName)}`),
  create: (body: SpringBootBatch) =>
            api.post<SpringBootBatch>('/batch-management', body),
  update: (batchName: string, body: SpringBootBatch) =>
            api.put<SpringBootBatch>(`/batch-management/${encodeURIComponent(batchName)}`, body),
  remove: (batchName: string) =>
            api.delete(`/batch-management/${encodeURIComponent(batchName)}`),
};

export const notificationsApi = {
  list:         (unreadOnly = false) =>
                  api.get<Notification[]>('/notifications', { params: unreadOnly ? { unread_only: true } : undefined }),
  unreadCount:  () =>
                  api.get<{ count: number }>('/notifications/unread-count'),
  markRead:     (id: number) =>
                  api.patch<Notification>(`/notifications/${id}/read`),
  markAllRead:  () =>
                  api.patch('/notifications/read-all'),
  remove:       (id: number) =>
                  api.delete(`/notifications/${id}`),
};

export const allocationApi = {
  getConfig:  (batchName: string) =>
                api.get<AllocationConfig>(`/allocation/${encodeURIComponent(batchName)}/config`),
  updateConfig: (batchName: string, body: { score_weight: number; dpi_weight: number }) =>
                api.put<AllocationConfig>(`/allocation/${encodeURIComponent(batchName)}/config`, body),
  run:        (batchName: string, mode: 'priority' | 'fit_score' = 'priority') =>
                api.post<AllocationRunResult>(`/allocation/${encodeURIComponent(batchName)}/run`, { mode }),
  list:       (batchName: string) =>
                api.get<TraineeAllocation[]>(`/allocation/${encodeURIComponent(batchName)}`),
  setOverride: (batchName: string, employeeId: string, body: { stream_id: number; reason: string }) =>
                api.patch<TraineeAllocation>(`/allocation/${encodeURIComponent(batchName)}/${encodeURIComponent(employeeId)}/override`, body),
  clearOverride: (batchName: string, employeeId: string) =>
                api.delete<TraineeAllocation>(`/allocation/${encodeURIComponent(batchName)}/${encodeURIComponent(employeeId)}/override`),
  freezeBatch:   (batchName: string) =>
                api.post<AllocationConfig>(`/allocation/${encodeURIComponent(batchName)}/freeze`),
  unfreezeBatch: (batchName: string) =>
                api.post<AllocationConfig>(`/allocation/${encodeURIComponent(batchName)}/unfreeze`),
  freezeTrainee:   (batchName: string, employeeId: string) =>
                api.post<TraineeAllocation>(`/allocation/${encodeURIComponent(batchName)}/${encodeURIComponent(employeeId)}/freeze`),
  unfreezeTrainee: (batchName: string, employeeId: string) =>
                api.post<TraineeAllocation>(`/allocation/${encodeURIComponent(batchName)}/${encodeURIComponent(employeeId)}/unfreeze`),
  exportExcel: (batchName: string) =>
                api.get(`/allocation/${encodeURIComponent(batchName)}/export`, { responseType: 'blob' }),
};

export const allocationAiApi = {
  generate: (batchName: string) =>
    api.post<AllocationAIRecommendation[]>(
      `/allocation/${encodeURIComponent(batchName)}/ai-recommendations/generate`,
      undefined,
      { timeout: 1800_000 }, // 30 min — matches backend httpx timeout
    ),
  list: (batchName: string) =>
    api.get<AllocationAIRecommendation[]>(`/allocation/${encodeURIComponent(batchName)}/ai-recommendations`),
};

export const smeRequestsApi = {
  create: (batchName: string, body: { stream_id: number; requested_employee_ids: string[] }) =>
    api.post<SMEAssociateRequest>(`/allocation/${encodeURIComponent(batchName)}/sme-requests`, body),
  list: (batchName: string) =>
    api.get<SMEAssociateRequest[]>(`/allocation/${encodeURIComponent(batchName)}/sme-requests`),
  review: (batchName: string, requestId: number, body: { approved_employee_ids: string[]; review_notes?: string }) =>
    api.post<SMEAssociateRequest>(`/allocation/${encodeURIComponent(batchName)}/sme-requests/${requestId}/review`, body),
  cancel: (batchName: string, requestId: number) =>
    api.delete(`/allocation/${encodeURIComponent(batchName)}/sme-requests/${requestId}`),
};

export const scoresUploadApi = {
  uploadExcel: (batchName: string, file: File) => {
    const form = new FormData();
    form.append('batch_name', batchName);
    form.append('file', file);
    return api.post<ScoresUploadResult>('/scores/upload-excel', form);
  },
  downloadTemplate: () =>
    api.get<Blob>('/scores/excel-template', { responseType: 'blob' }),
  streamReferences: (batchName?: string) =>
    api.get<StreamReference[]>('/scores/stream-references', {
      params: batchName ? { batch_name: batchName } : undefined,
    }),
  batchInfo: (batchName: string) =>
    api.get<{ batch_name: string; dpi_count: number; has_existing: boolean; excel_managed: boolean; uploaded_at: string | null }>(`/scores/batch-info/${encodeURIComponent(batchName)}`),
  excelBatches: () =>
    api.get<{ batch_name: string; uploaded_at: string; trainee_count: number }[]>('/scores/excel-batches'),
};

export const dashboardApi = {
  stats: (batchName?: string) =>
    api.get<DashboardStats>('/dashboard/stats', {
      params: batchName ? { batch_name: batchName } : undefined,
    }),
};

export const syncApi = {
  batches:          () => api.get<SyncedBatch[]>('/sync/batches'),
  dpi:              (batchName?: string) =>
                      api.get<SyncedDpiRecord[]>('/sync/dpi', { params: batchName ? { batch_name: batchName } : undefined }),
  scores:           () => api.get<SyncedSubjectScore[]>('/sync/scores'),
  status:           () => api.get<SyncStatus>('/sync/status'),
  trigger:          (preserveExcel = false) =>
                      api.post<SyncTriggerResponse>('/sync/trigger', null, {
                        params: preserveExcel ? { preserve_excel: true } : undefined,
                      }),
};
