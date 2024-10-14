import { Request, Response } from "express";
export class ServerController {
    constructor() {
    }

    public async NotifyOnline(req: Request, res: Response) {
        res.status(200).send("server is online");
    }
}