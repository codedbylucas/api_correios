import axios, { AxiosInstance, AxiosError } from 'axios';

export interface WoncaTrackResponse {
  code: string;
  status?: string;
  events?: any[];
  [key: string]: any;
}

export class WoncaClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, auth: string, timeout: number) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': auth,
      },
    });
  }

  async track(code: string, retryCount = 0): Promise<WoncaTrackResponse> {
    try {
      console.log(`[WoncaClient] Calling Wonca for code: ${code} (Attempt ${retryCount + 1})`);
      const response = await this.client.post('', { code });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      
      console.error(`[WoncaClient] Error for code ${code}:`, {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data
      });
      
      // Retry logic for transient errors (429, 502, 503, 504)
      const transientStatuses = [429, 502, 503, 504];
      if (
        retryCount < 1 && 
        axiosError.response && 
        transientStatuses.includes(axiosError.response.status)
      ) {
        // Simple backoff: wait 1s before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.track(code, retryCount + 1);
      }
      
      throw error;
    }
  }
}
