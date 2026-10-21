'use strict';

angular.module('bahmni.appointments')
    .service('appointmentsServiceService', ['$http', 'ethiopianGregorianService',
        function ($http,ethiopianGregorianService) {
            this.save = function (service) {
                return $http.post(Bahmni.Appointments.Constants.createServiceUrl, service, {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getAllServices = function () {
                return $http.get(Bahmni.Common.Constants.appointmentServiceUrl + "/all/default", {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getAllServicesWithServiceTypes = function () {
                return $http.get(Bahmni.Common.Constants.appointmentServiceUrl + "/all/full", {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getServiceLoad = function (serviceUuid, startDateTime, endDateTime) {
                var params = {uuid: serviceUuid, startDateTime: startDateTime, endDateTime: endDateTime};
                return $http.get(Bahmni.Appointments.Constants.getServiceLoad, {
                    params: params,
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.getService = function (uuid) {
                return $http.get(Bahmni.Common.Constants.appointmentServiceUrl + "?uuid=" + uuid, {
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };

            this.checkIfDateIsHoliday = function (date){
                
                var dateObj = new Date(date);
                var day = String(dateObj.getDate()).padStart(2, '0');
                var month = String(dateObj.getMonth() + 1).padStart(2, '0');
                var year = dateObj.getFullYear();
                var formattedDate = `${month}/${day}/${year}`;
                /* dateObj.setDate(dateObj.getDate() + 1);
                var dateStr = dateObj.toISOString().split('T')[0]; */   
                 
                var ethiopianDate = ethiopianGregorianService.gregToEth(formattedDate);
                var dateSplit = ethiopianDate.split("/")
                
               /* const timeMin = `${dateStr}T00:00:00Z`;
               const timeMax = `${dateStr}T23:59:59Z`; */
               
                return $http.get(Bahmni.Common.Constants.calendarUrl, {
                    params: {day: dateSplit[0], month: dateSplit[1], year: dateSplit[2]},
                });
            }

            this.deleteAppointmentService = function (serviceUuid) {
                var params = {uuid: serviceUuid};
                return $http.delete(Bahmni.Common.Constants.appointmentServiceUrl, {
                    params: params,
                    withCredentials: true,
                    headers: {"Accept": "application/json", "Content-Type": "application/json"}
                });
            };
        }]);
