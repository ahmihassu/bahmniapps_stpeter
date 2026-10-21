'use strict';

angular.module('bahmni.common.queue')
    .factory('queueService', ['$http', '$q', function ($http, $q) {
        var queueApiBase = "http://queue:5000";
        var persistedCurrentServing = null;

        function setPersistedCurrentServing(value) {
            persistedCurrentServing = value;
        }

        function getPersistedCurrentServing() {
            return persistedCurrentServing;
        }

        var getQueueLocations = function () {
            return $http.get(queueApiBase + "/api/locations").then(function (locations) {
                return locations.data;
            });
        };

        var getLocation = function (name) {
            return getQueueLocations().then(function (locations) {
                return _.find(locations, function (location) {
                    return location.name && name && location.name.toLowerCase() === name.toLowerCase();
                });
            });
        };

        function callNext(locationName) {
            return getLocation(locationName).then(function (location) {
                if (!location || !location.id) {
                    return $q.reject({ data: { message: 'Location not found: ' + locationName } });
                }
                return $http.get(queueApiBase + "/api/location/" + location.id)
                    .then(function (locRes) {
                        var currentLocation = locRes.data;
                        var currentTicketNumber = (currentLocation && typeof currentLocation.serving === "number") ? currentLocation.serving : 0;
                        return $http.post(queueApiBase + "/api/call-next", {
                            locationId: location.id,
                            currentTicketNumber: currentTicketNumber
                        });
                    })
                    .then(function (callRes) {
                        return callRes.data;
                    });
            });
        }

        function assignTicket(locationName, ticketNumber) {
            var ticketNum = typeof ticketNumber === 'number' ? ticketNumber : parseInt(ticketNumber, 10);
            if (isNaN(ticketNum)) {
                return $q.reject({ data: { message: 'Invalid ticket number' } });
            }
            return getLocation(locationName).then(function (location) {
                if (!location || !location.id) {
                    return $q.reject({ data: { message: 'Location not found: ' + locationName } });
                }
                return $http.post(queueApiBase + "/api/assign-ticket", {
                    locationId: location.id,
                    ticketNumber: ticketNum
                }).then(function (res) { return res.data; });
            });
        }

        function getSkippedTickets(locationName) {
         return getLocation(locationName).then(function (skipLocation) {
            return $http.get(queueApiBase + "/api/tickets/skipped/" + skipLocation.id).then(function (res) {
                return res.data || [];
            });
         });
        }

        return {
            getLocation: getLocation,
            callNext: callNext,
            assignTicket: assignTicket,
            getSkippedTickets: getSkippedTickets,
            getQueueLocations: getQueueLocations,
            setPersistedCurrentServing: setPersistedCurrentServing,
            getPersistedCurrentServing: getPersistedCurrentServing
        };
    }]);
