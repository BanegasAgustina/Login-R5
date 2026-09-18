import app from './app.js';

const port = process.env.PORT || 3000;
const server = app.listen(port, () => console.log(`API PetCare en puerto ${server.address().port}`));
export { app, server };
