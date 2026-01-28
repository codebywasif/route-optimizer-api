const DistanceMatrixService = require('./distanceMatrixService');

class RouteOptimizer {
    constructor() {
        this.distanceService = new DistanceMatrixService();
    }

    async optimize({ pickup, viaPoints, destination, pickupTime, timeWindows }) {
        // If no via points, return simple route
        if (!viaPoints || viaPoints.length === 0) {
            const distance = await this.distanceService.calculateDistance(pickup, destination);
            return {
                optimizedRoute: [pickup, destination],
                totalDistanceKm: distance.distanceKm,
                totalTimeMinutes: distance.timeMinutes,
                originalOrder: [pickup, destination],
                optimizationApplied: false
            };
        }

        // Build all stops
        const allStops = [pickup, ...viaPoints, destination];

        // Get distance matrix
        console.log('🗺️  Calculating distance matrix...');
        const distanceMatrix = await this.distanceService.getDistanceMatrix(allStops);

        // Generate all permutations of via points
        console.log('🔄 Generating route permutations...');
        const permutations = this.getPermutations(viaPoints);

        let bestRoute = null;
        let bestScore = Infinity;
        let bestDetails = null;

        const startTime = new Date(pickupTime);

        // Evaluate each permutation
        for (const permutation of permutations) {
            const route = [pickup, ...permutation, destination];
            const { score, details } = this.scoreRoute(
                route, 
                distanceMatrix, 
                allStops,
                startTime,
                timeWindows
            );

            if (score < bestScore) {
                bestScore = score;
                bestRoute = route;
                bestDetails = details;
            }
        }

        // Calculate original route score for comparison
        const originalRoute = [pickup, ...viaPoints, destination];
        const { score: originalScore, details: originalDetails } = this.scoreRoute(
            originalRoute,
            distanceMatrix,
            allStops,
            startTime,
            timeWindows
        );

        return {
            optimizedRoute: bestRoute.map((stop, index) => ({
                ...stop,
                sequenceNumber: index,
                arrivalTime: bestDetails.arrivalTimes[index],
                waitingTimeMinutes: bestDetails.waitingTimes[index] || 0
            })),
            originalRoute: originalRoute.map((stop, index) => ({
                ...stop,
                sequenceNumber: index,
                arrivalTime: originalDetails.arrivalTimes[index]
            })),
            totalDistanceKm: bestDetails.totalDistance,
            totalTimeMinutes: bestDetails.totalTime,
            timeSavedMinutes: parseFloat((originalDetails.totalTime - bestDetails.totalTime).toFixed(2)),
            distanceSavedKm: parseFloat((originalDetails.totalDistance - bestDetails.totalDistance).toFixed(2)),
            optimizationApplied: true,
            penalties: {
                optimized: bestDetails.penalties,
                original: originalDetails.penalties
            },
            metadata: {
                permutationsEvaluated: permutations.length,
                pickupTime: pickupTime,
                optimizationScore: parseFloat(bestScore.toFixed(2)),
                originalScore: parseFloat(originalScore.toFixed(2))
            }
        };
    }

    scoreRoute(route, distanceMatrix, allStops, startTime, timeWindows) {
        let totalTime = 0;
        let totalDistance = 0;
        let penalties = 0;
        let currentTime = new Date(startTime);
        const arrivalTimes = [];
        const waitingTimes = [];

        arrivalTimes.push(currentTime.toISOString());
        waitingTimes.push(0);

        for (let i = 0; i < route.length - 1; i++) {
            const fromIndex = allStops.findIndex(
                s => s.latitude === route[i].latitude && s.longitude === route[i].longitude
            );
            const toIndex = allStops.findIndex(
                s => s.latitude === route[i + 1].latitude && s.longitude === route[i + 1].longitude
            );

            const segment = distanceMatrix[fromIndex][toIndex];
            const travelMinutes = segment.timeMinutes;
            const distanceKm = segment.distanceKm;

            currentTime = new Date(currentTime.getTime() + travelMinutes * 60 * 1000);
            totalTime += travelMinutes;
            totalDistance += distanceKm;

            // Check time window constraints
            const stopId = route[i + 1].id || `stop_${i + 1}`;
            let waitingTime = 0;

            if (timeWindows && timeWindows[stopId]) {
                const window = timeWindows[stopId];
                const earliestTime = new Date(window.earliest);
                const latestTime = new Date(window.latest);

                if (currentTime < earliestTime) {
                    // Too early - need to wait
                    waitingTime = (earliestTime - currentTime) / (60 * 1000);
                    penalties += waitingTime * 2; // Waiting penalty factor
                    currentTime = earliestTime;
                    totalTime += waitingTime;
                } else if (currentTime > latestTime) {
                    // Too late - heavy penalty (especially for school runs)
                    const lateMinutes = (currentTime - latestTime) / (60 * 1000);
                    penalties += lateMinutes * 10; // Late penalty factor (5x worse than waiting)
                }
            }

            arrivalTimes.push(currentTime.toISOString());
            waitingTimes.push(waitingTime);
        }

        const score = totalTime + penalties;

        return {
            score,
            details: {
                totalTime: parseFloat(totalTime.toFixed(2)),
                totalDistance: parseFloat(totalDistance.toFixed(2)),
                penalties: parseFloat(penalties.toFixed(2)),
                arrivalTimes,
                waitingTimes
            }
        };
    }

    getPermutations(array) {
        if (array.length === 0) return [[]];
        if (array.length === 1) return [array];

        const permutations = [];

        for (let i = 0; i < array.length; i++) {
            const element = array[i];
            const remaining = array.slice(0, i).concat(array.slice(i + 1));
            const remainingPermutations = this.getPermutations(remaining);

            for (const perm of remainingPermutations) {
                permutations.push([element, ...perm]);
            }
        }

        return permutations;
    }
}

module.exports = RouteOptimizer;