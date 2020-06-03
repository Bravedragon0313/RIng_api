import * as express from 'express';
import { createServer, Server } from 'http';
import * as socketIo from 'socket.io';


export class ChatServer {

    public static readonly PORT: number = 5000;
    private app: express.Application;
    private port: string | number;
    private server: Server; // new

    constructor() {
        this.createApp();
        this.config();
        this.createServer(); // new
        this.sockets();
        this.listen();
    }
    private socketsArray = [];

    private createApp(): void {
        this.app = express();
        this.app.use(express.static('public'));
    }

    private config(): void {
        this.port = process.env.PORT || ChatServer.PORT;
    }

    private listen(): void {
        // new
        this.server.listen(this.port, () => {
            console.log('Running server on port %s', this.port);
        });
        this.io.on('connection', (socket) => {
            socket.broadcast.emit('add-users', {
                users: [socket.id]
            });

            socket.on('disconnect', () => {
                this.socketsArray.splice(this.socketsArray.indexOf(socket.id), 1);
                this.io.emit('remove-user', socket.id);
            });

        });
    }
    

    // new
    private createServer(): void {
        this.server = createServer(this.app);
    }
    private sockets(): void {
        this.io = socketIo(this.server);
    }
    public getApp(): express.Application {
        return this.app;
    }

}
socket.on('make-offer', function (data) {
    socket.to(data.to).emit('offer-made', {
      offer: data.offer,
      socket: socket.id
    });
  });