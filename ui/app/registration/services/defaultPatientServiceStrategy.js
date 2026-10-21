'use strict';

angular.module('bahmni.registration')
    .service('patientServiceStrategy', ['$http', '$q', '$rootScope', function ($http, $q, $rootScope) {
        var openmrsUrl = Bahmni.Registration.Constants.openmrsUrl;
        var baseOpenMRSRESTURL = Bahmni.Registration.Constants.baseOpenMRSRESTURL;

        var search = function (config) {
            var defer = $q.defer();
            var patientSearchUrl = Bahmni.Common.Constants.bahmniSearchUrl;
            if (config && config.params.identifier) {
                patientSearchUrl = Bahmni.Common.Constants.bahmniSearchUrl;
            }
            var onResults = function (result) {
                defer.resolve(result);
            };
            $http.get(patientSearchUrl, config).success(onResults)
                .error(function (error) {
                    defer.reject(error);
                });
            return defer.promise;
        };

        var fetchPatient = function (config){
            var fullName = undefined;
            var identifier = null;
            var addressVal = undefined;
            var phoneNumber = undefined;
            var ART_NO = undefined;
            if(config.params.q!= "" && config.params.q!= undefined){
                fullName = config.params.q.split("%");
            }
            if(config.params.identifier!=undefined){
                identifier = config.params.identifier;
            }
            if(config.params.addressFieldValue!=undefined && config.params.addressFieldValue!=""){
                addressVal = config.params.addressFieldValue
            }
            if(config.params.customAttribute!="" && config.params.customAttribute!=undefined){
                phoneNumber = config.params.customAttribute
            }
            if(config.params.programAttributeFieldValue!="" && config.params.programAttributeFieldValue!=undefined){
                ART_NO = config.params.programAttributeFieldValue;
            }
            var config = {
                method: "GET",
                params: {
                    q: "emrapi.sqlsearch.fetchPatient",
                    identifier : identifier != undefined ? identifier : '',
                    given_name:  fullName != undefined && fullName[0] != undefined ? fullName[0] : '',
                    middle_name: fullName != undefined && fullName[1] != undefined? fullName[1] : '',
                    family_name: fullName != undefined && fullName[2] != undefined ? fullName[2] : '',
                    addressVal : addressVal != undefined ? addressVal : '',
                    phoneNumber : phoneNumber != undefined ? phoneNumber : '',
                    ART_NO : ART_NO != undefined ? ART_NO : '',
                },
                withCredentials: true
            };
            var newResult = [];
            var defer = $q.defer();
            var patientSearchUrl = "/openmrs/ws/rest/v1/bahmnicore/sql";
            var newResult = [];
            var onResults = function (result) {
                for (var i = 0; i < result.length; i++) {
                    /* var patientProgramAttributeValue = null;
                    var ID_Number = [];
                  
                    if(result[i].ART_ID!=""){
                          ID_Number= [result[i].ART_ID.toString()];
                      
                          patientProgramAttributeValue=  {
                            "ID_Number": ID_Number
                        }
                    } */
                    var customAttribute = null;
                    if (result[i].phone_number != "" && result[i].phone_number != "val") {
                        customAttribute = JSON.stringify({
                            "Phone Number": result[i].phone_number
                        })
                    }
                    var fliter = {
                        "$$hashKey": "object:" + i,
                        "activeVisitUuid": result[i].activeVisitUuid,
                        "addressFieldValue": {
                            "city_village": result[i].city_village!= "" && result[i].city_village!= "val" ? result[i].city_village : null,
                            "country": result[i].country!= "" && result[i].country!= "val" ? result[i].country : null,
                        },
                        "customAttribute": customAttribute,
                        "age": result[i].age,
                        "birthDate": result[i].birthDate,
                        "dateCreated": result[i].dateCreated,
                        "deathDate": result[i].deathDate != "" ? result[i].deathDate : null,
                        "extraIdentifiers": result[i].extraIdentifiers != "" ? result[i].extraIdentifiers : null,
                        "familyName": result[i].familyName,
                        "gender": result[i].gender,
                        "givenName": result[i].givenName,
                        "hasBeenAdmitted": result[i].hasBeenAdmitted,
                        "identifier": result[i].identifier,
                        "middleName": result[i].middleName,
                        "personId": result[i].person_id,
                        "uuid": result[i].uuid
                    }
                    newResult.push(fliter);
                }
                var display = {
                    "totalCount": newResult.length,
                    "pageOfResults": newResult
                }
                defer.resolve(display);
            };
            $http.get(patientSearchUrl, config).success(onResults)
                .error(function (error) {
                    defer.reject(error);
                });
            return defer.promise;
        };

        var getByUuid = function (uuid) {
            var url = openmrsUrl + "/ws/rest/v1/patientprofile/" + uuid;
            var config = {
                method: "GET",
                params: {v: "full"},
                withCredentials: true
            };

            var defer = $q.defer();
            $http.get(url, config).success(function (result) {
                defer.resolve(result);
            });
            return defer.promise;
        };

        var create = function (patient, jumpAccepted) {
            var data = new Bahmni.Registration.CreatePatientRequestMapper(moment()).mapFromPatient($rootScope.patientConfiguration.attributeTypes, patient);
            var url = baseOpenMRSRESTURL + "/bahmnicore/patientprofile";
            return $http.post(url, data, {
                withCredentials: true,
                headers: {"Accept": "application/json", "Content-Type": "application/json", "Jump-Accepted": jumpAccepted}
            });
        };

        var update = function (patient, openMRSPatient, attributeTypes) {
            var deferred = $q.defer();
            var data = new Bahmni.Registration.UpdatePatientRequestMapper(moment()).mapFromPatient(attributeTypes, openMRSPatient, patient);
            var url = baseOpenMRSRESTURL + "/bahmnicore/patientprofile/" + openMRSPatient.uuid;
            var config = {
                withCredentials: true,
                headers: {"Accept": "application/json", "Content-Type": "application/json"}
            };
            $http.post(url, data, config).then(function (result) {
                deferred.resolve(result);
            }, function (reason) {
                deferred.resolve(reason);
            });
            return deferred.promise;
        };

        var generateIdentifier = function (patient) {
            var data = {"identifierSourceName": patient.identifierPrefix ? patient.identifierPrefix.prefix : ""};
            var url = openmrsUrl + "/ws/rest/v1/idgen";
            var config = {
                withCredentials: true,
                headers: {"Accept": "text/plain", "Content-Type": "application/json"}
            };
            return $http.post(url, data, config);
        };

        return {
            search: search,
            fetchPatient: fetchPatient,
            get: getByUuid,
            create: create,
            update: update,
            generateIdentifier: generateIdentifier
        };
    }]);
