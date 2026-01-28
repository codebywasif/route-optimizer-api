const RouteOptimizer = require('../services/routeOptimizer');
const NodeCache = require('node-cache');

// Initialize cache with TTL from env
const cache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL) || 3600 });

exports.optimizeRoute = async (req, res) => {
    try {
        const { pickup, viaPoints, destination, pickupTime, timeWindows } = req.body;

        // Validate input
        if (!pickup || !destination) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'pickup and destination are required'
            });
        }

        if (!pickup.latitude || !pickup.longitude) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'pickup must have latitude and longitude'
            });
        }

        if (!destination.latitude || !destination.longitude) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'destination must have latitude and longitude'
            });
        }

        // Validate via points if provided
        if (viaPoints && !Array.isArray(viaPoints)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'viaPoints must be an array'
            });
        }

        if (viaPoints) {
            for (let i = 0; i < viaPoints.length; i++) {
                if (!viaPoints[i].latitude || !viaPoints[i].longitude) {
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: `viaPoints[${i}] must have latitude and longitude`
                    });
                }
            }
        }

        // Generate cache key
        const cacheKey = generateCacheKey(pickup, viaPoints || [], destination);
        
        // Check cache
        const cachedResult = cache.get(cacheKey);
        if (cachedResult) {
            console.log('📦 Cache hit for route');
            return res.json({
                ...cachedResult,
                cached: true
            });
        }

        // Optimize route
        const optimizer = new RouteOptimizer();
        const result = await optimizer.optimize({
            pickup,
            viaPoints: viaPoints || [],
            destination,
            pickupTime: pickupTime || new Date().toISOString(),
            timeWindows: timeWindows || {}
        });

        // Cache the result
        cache.set(cacheKey, result);

        res.json({
            ...result,
            cached: false
        });

    } catch (error) {
        console.error('Error optimizing route:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
};

function generateCacheKey(pickup, viaPoints, destination) {
    const locations = [pickup, ...viaPoints, destination]
        .map(loc => `${loc.latitude.toFixed(6)},${loc.longitude.toFixed(6)}`)
        .join('|');
    return `route_${Buffer.from(locations).toString('base64')}`;
}