import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { rateLimit } from "express-rate-limit";
import { AppError } from "./lib/domain";
import { ZodError } from "zod";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.set("trust proxy", 1);
app.use(cors({ origin: false }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api",rateLimit({windowMs:60000,limit:120,standardHeaders:"draft-8",legacyHeaders:false}));
app.use((req,res,next)=>{
  if(!["GET","HEAD","OPTIONS"].includes(req.method)){
    const origin=req.get("origin");
    const host=req.get("x-forwarded-host")||req.get("host");
    if(origin&&new URL(origin).host!==host){res.status(403).json({error:"Cross-origin writes are not allowed."});return;}
  }
  // This first build is a private, single-workspace development tool.
  // Do not expose store-admin actions through a public deployment before managed auth is integrated.
  if(process.env.NODE_ENV==="production"&&!["/api/healthz"].includes(req.path)){
    res.status(503).json({error:"Public deployment is locked until workspace authentication and authorization are configured."});return;
  }
  next();
});

app.use("/api", router);
app.use((err:unknown,req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(err instanceof ZodError){res.status(400).json({error:"Invalid input or response shape",details:err.issues.map(i=>({path:i.path,message:i.message}))});return;}
  const status=err instanceof AppError?err.status:500;
  req.log.warn({status},"Request failed");
  res.status(status).json({error:err instanceof AppError?err.message:"The server could not complete this operation. Check the run status or try again."});
});

export default app;
