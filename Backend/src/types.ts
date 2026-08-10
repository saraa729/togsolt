import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Request, Response } from 'express';

export type Currency = 'MNT' | 'USD' | string;
export type Locale = 'mn' | 'en' | string;

export type Money = {
  amount: number;
  currency: Currency;
};

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export type RouteParams = Record<string, string>;

export type RouteContext = {
  req: IncomingMessage & Partial<Request> & { body?: unknown };
  res: ServerResponse & Partial<Response>;
  url: URL;
  params: RouteParams;
  user: any | null;
  setCookie: (res: ServerResponse & Partial<Response>, cookie: string) => void;
  sendText: (
    res: ServerResponse & Partial<Response>,
    status: number,
    body: string,
    contentType?: string
  ) => void;
};

export type RouteResult = unknown | void;
export type RouteHandler = (ctx: RouteContext) => RouteResult | Promise<RouteResult>;
export type RouteRegistrar = (method: HttpMethod, pattern: string, handler: RouteHandler) => void;

export type RegisteredRoute = {
  method: HttpMethod;
  pattern: string;
  handler: RouteHandler;
  regex?: RegExp;
  names?: string[];
};

export type IdFactory = (prefix: string) => string;
export type NowFactory = () => string;
export type MoneyFactory = (amount: number, currency?: Currency) => Money;
export type AddMoney = (a: Money | null, b: Money) => Money;
export type PercentBps = (value: number, bps: number) => number;
export type HttpErrorFactory = (status: number, code: string, message: string, details?: unknown) => Error & {
  status?: number;
  code?: string;
  details?: unknown;
};
export type Localize = (value: unknown, locale?: Locale) => unknown;

export type AppDatabase = Record<string, any>;

export type AuditFn = (
  actorId: string | null | undefined,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata?: Record<string, unknown>
) => void;

export type CoreServices = {
  db: AppDatabase;
  audit: AuditFn;
  id: IdFactory;
  now: NowFactory;
  money: MoneyFactory;
  addMoney: AddMoney;
  httpError: HttpErrorFactory;
  localize: Localize;
};

export type ServiceFactory<TInput extends object, TOutput extends object> = (input: TInput) => TOutput;

export type AppContext = Record<string, any> & {
  route: RouteRegistrar;
  db: AppDatabase;
  now: NowFactory;
  id: IdFactory;
  money: MoneyFactory;
  addMoney: AddMoney;
  percentBps: PercentBps;
  httpError: HttpErrorFactory;
  audit: AuditFn;
};
