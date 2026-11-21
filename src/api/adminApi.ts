import { apiRequest, unwrap } from './http';
import { normalizeOrder, normalizePage, type OrderDto, type OrderDetail, type Page } from './customerApi';

const PREFIX = '/api/v1/admin';
const q = (v: Record<string, string | number | undefined>) => {const p = new URLSearchParams();for(const [k,x] of Object.entries(v)) if(x !== undefined && x !== '')p.set(k,String(x));return p.toString();};
async function get<T>(path: string): Promise<T> {return unwrap<T>(await apiRequest<any>(path));}
export type AdminOrderAction = {action:'ACCEPTED'|'REJECTED'|'IN_PROGRESS'|'COMPLETED'|'PARTIALLY_COMPLETED'|'FAILED'|'CANCELLED'|'PROGRESS';quantityCompleted?:number;reasonCode?:string;customerNote?:string;internalNote?:string};
export type AdminTopupSummary = {totalCreditedAmount:string;creditedCount:number;pendingCount:number;reviewCount:number;allRequestsCount:number;currencyCode:string;meaning:string};
export type AdminCustomerRow = {userId:number;customerNumber:string|null;displayName:string;emailMasked:string;phoneMasked:string;status:string;phoneVerified:boolean;emailVerified:boolean;createdAt:string};
export type AdminAuditRow = {id:number;actorUserId:number;actionCode:string;targetType:string;targetId:number|null;reason:string;createdAt:string};
export type AdminTopupRow = {topupNumber:string;customerId:number;requestedAmount:string;status:string;createdAt:string;creditedAt:string|null};
export const adminApi = {
  orders: async (filter:{status?:string;page?:number;size?:number}={}):Promise<Page<OrderDto>> => normalizePage<OrderDto>(await get<any>(`${PREFIX}/orders?${q({status:filter.status,page:filter.page??0,size:filter.size??20})}`),normalizeOrder),
  order: (n:string)=>get<OrderDetail>(`${PREFIX}/orders/${encodeURIComponent(n)}`),
  orderAction: (n:string,b:AdminOrderAction)=>apiRequest<any>(`${PREFIX}/orders/${encodeURIComponent(n)}/actions`,{method:'POST',body:JSON.stringify(b)}).then(r=>normalizeOrder(unwrap<any>(r))),
  topupSummary: ()=>get<AdminTopupSummary>(`${PREFIX}/payments/topups/summary`),
  topups: (page=0,size=20)=>get<Page<AdminTopupRow>>(`${PREFIX}/payments/topups?page=${page}&size=${size}`),
  customers: (page=0,size=20)=>get<Page<AdminCustomerRow>>(`${PREFIX}/customers?page=${page}&size=${size}`),
  auditLogs: (page=0,size=20)=>get<Page<AdminAuditRow>>(`${PREFIX}/audit-logs?page=${page}&size=${size}`),
};
