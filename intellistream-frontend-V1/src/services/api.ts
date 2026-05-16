import axios from 'axios';
import type { UserResponse } from '../types/auth';
import type { SyncedBatch, SyncedDpiRecord, SyncedSubjectScore, SyncStatus, SyncTriggerResponse } from '../types/sync';
import type { BatchStream, StreamCreate, StreamTemplate, StreamTemplateDetail, SubjectWeight, WeightProposal, WeightsSet } from '../types/streams';
import type { SpringBootBatch } from '../types/batch_management';
import type {
  BRCreate,
  BRResponse,
  BRSummary,
  BRUpdate,
  ExcelImportResult,
} from '../types/business_requirements';

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
  setWeights:      (batchName: string, streamId: number, body: WeightsSet) =>
                     api.post<BatchStream>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/weights`, body),
  listProposals:   (batchName: string, streamId: number) =>
                     api.get<WeightProposal[]>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/proposals`),
  approveProposal: (batchName: string, streamId: number, proposalId: number) =>
                     api.post<WeightProposal>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/proposals/${proposalId}/approve`),
  rejectProposal:  (batchName: string, streamId: number, proposalId: number, body: { rejection_reason?: string }) =>
                     api.post<WeightProposal>(`/batches/${encodeURIComponent(batchName)}/streams/${streamId}/proposals/${proposalId}/reject`, body),
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

export const syncApi = {
  batches:          () => api.get<SyncedBatch[]>('/sync/batches'),
  dpi:              (batchName?: string) =>
                      api.get<SyncedDpiRecord[]>('/sync/dpi', { params: batchName ? { batch_name: batchName } : undefined }),
  scores:           () => api.get<SyncedSubjectScore[]>('/sync/scores'),
  status:           () => api.get<SyncStatus>('/sync/status'),
  trigger:          () => api.post<SyncTriggerResponse>('/sync/trigger'),
};
