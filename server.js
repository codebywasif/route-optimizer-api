require('dotenv').config();
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚖 Route Optimizer API is running on port ${PORT}`);
    console.log(`📍 API Endpoint: http://localhost:${PORT}/api/optimize-route`);
    console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
});