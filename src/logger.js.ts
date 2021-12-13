
class Logger {
    
    private readonly environment : string;
    private static instance : Logger;
    
    private constructor() {
        Logger.instance = this;
        this.environment = process.env.NODE_ENV ? process.env.NODE_ENV.toLowerCase() : "development";
    }
    
    public static getInstance(){
        if(!Logger.instance){
            return Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    
    public debug(msg : string){
        if(this.environment !== "development") return;
        console.log(`[${Date.now().toString()}][DEBUG] : ${msg}`);
    }
    
    public error(msg : string){
        console.error(`[${Date.now().toString()}][ERROR] : ${msg}`);
    }
    
}

export const logger  = Logger.getInstance();