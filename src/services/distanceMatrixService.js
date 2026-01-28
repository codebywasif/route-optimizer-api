const axios = require('axios');
const haversine = require('../utils/haversine');

class DistanceMatrixService {
    constructor() {
        this.useGoogleAPI = process.env.USE_GOOGLE_API === 'true';
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.averageSpeedKmh = parseFloat(process.env.AVERAGE_SPEED_KMH) || 30;
    }

    async getDistanceMatrix(stops) {
        if (this.useGoogleAPI && this.apiKey) {
            return await this.getGoogleDistanceMatrix(stops);
        } else {
            return this.getHaversineDistanceMatrix(stops);
        }
    }

    async getGoogleDistanceMatrix(stops) {
        const origins = stops.map(s => `${s.latitude},${s.longitude}`).join('|');
        const destinations = origins;

        const url = `https://maps.googleapis.com/maps/api/distancematrix/json`;
        
        try {
            const response = await axios.get(url, {
                params: {
                    origins,
                    destinations,
                    key: this.apiKey,
                    mode: 'driving'
                }
            });

            if (response.data.status !== 'OK') {
                throw new Error(`Google API error: ${response.data.status}`);
            }

            const matrix = [];
            
            for (let i = 0; i < stops.length; i++) {
                matrix[i] = [];
                for (let j = 0; j < stops.length; j++) {
                    const element = response.data.rows[i].elements[j];
                    
                    if (element.status === 'OK') {
                        matrix[i][j] = {
                            distanceKm: element.distance.value / 1000,
                            timeMinutes: element.duration.value / 60
                        };
                    } else {
                        // Fallback to haversine
                        const distance = haversine(
                            stops[i].latitude,
                            stops[i].longitude,
                            stops[j].latitude,
                            stops[j].longitude
                        );
                        matrix[i][j] = {
                            distanceKm: distance,
                            timeMinutes: (distance / this.averageSpeedKmh) * 60
                        };
                    }
                }
            }

            return matrix;

        } catch (error) {
            console.warn('Google API failed, falling back to Haversine:', error.message);
            return this.getHaversineDistanceMatrix(stops);
        }
    }

    getHaversineDistanceMatrix(stops) {
        const matrix = [];

        for (let i = 0; i < stops.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < stops.length; j++) {
                if (i === j) {
                    matrix[i][j] = {
                        distanceKm: 0,
                        timeMinutes: 0
                    };
                } else {
                    const distance = haversine(
                        stops[i].latitude,
                        stops[i].longitude,
                        stops[j].latitude,
                        stops[j].longitude
                    );
                    
                    matrix[i][j] = {
                        distanceKm: parseFloat(distance.toFixed(2)),
                        timeMinutes: parseFloat(((distance / this.averageSpeedKmh) * 60).toFixed(2))
                    };
                }
            }
        }

        return matrix;
    }

    async calculateDistance(from, to) {
        if (this.useGoogleAPI && this.apiKey) {
            const matrix = await this.getGoogleDistanceMatrix([from, to]);
            return matrix[0][1];
        } else {
            const distance = haversine(
                from.latitude,
                from.longitude,
                to.latitude,
                to.longitude
            );
            return {
                distanceKm: parseFloat(distance.toFixed(2)),
                timeMinutes: parseFloat(((distance / this.averageSpeedKmh) * 60).toFixed(2))
            };
        }
    }
}

module.exports = DistanceMatrixService;