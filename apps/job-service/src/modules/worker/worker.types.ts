export type ListWorkersFilter = {
  status?: string;
  page: number;
  limit: number;
}
export type ListWorkersResult = {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages:number
}