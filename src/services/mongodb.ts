import mongoose from 'mongoose';

mongoose
    .connect(process.env.MONGOURI!)
    .then(() => console.log('Connected to DB successfully'))
    .catch((e) => console.error(`Failed to connect to DB : ${e}`));

    