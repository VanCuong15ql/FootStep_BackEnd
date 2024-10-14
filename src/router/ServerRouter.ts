import { Router } from "express";
import { ServerController } from "../controller/ServerController";
export class ServerRouter {
    public router: Router;
    public serverController = new ServerController();
    constructor() {
        this.router = Router();
        this.routes();
    }

    routes(): void {
        this.router.get("/", this.serverController.NotifyOnline);
    }
}