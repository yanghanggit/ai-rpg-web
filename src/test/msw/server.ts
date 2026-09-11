/**
 * MSW Node 服务：测试中拦截真实网络请求。
 *
 * 生命周期在 src/test/setup.ts 中统一管理；各测试用 server.use(...) 注册当次用例的 handler。
 */
import { setupServer } from "msw/node";

export const server = setupServer();
