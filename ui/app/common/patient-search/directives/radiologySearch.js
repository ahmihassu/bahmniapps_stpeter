'use strict';

angular.module('bahmni.common.patientSearch')
.directive('radiologySearch', function () {
  
    return {
        restrict: 'E',
        templateUrl: '../common/patient-search/views/radiologySearch.html',
        scope: {
            search : "="
        },
        controller: RadiologySearchControllerFunction,
        bindToController : true,
        controllerAs : 'radCtrl'
    };
});

function RadiologySearchControllerFunction(){
    var radCtrl = this;

    radCtrl.params = {
        nameOrID : '',
        request : '',
        ptCondition: '',
        location: ''
    }
    
    radCtrl.filterPatients = function (matchingCriteria) {
        radCtrl.search.searchResults = radCtrl.search.activePatients.filter(matchingCriteria)
    };

    radCtrl.filterPatientsByCriteria = function(criteria)
    {
        switch (criteria) {
            case "name":
                radCtrl.filterPatients(matchesNameOrId);
                break;
            case "request":
                radCtrl.filterPatients(matchesRequest);
                break;
            case "ptCondition":
                radCtrl.filterPatients(matchesPtCondition);
                break;
            case "location":
                radCtrl.filterPatients(matchesLocation);
                break;
            
        }
    }

    var matchesNameOrId = function (patient) {
        return patient.display.toLowerCase().indexOf(radCtrl.params.nameOrID.toLowerCase()) !== -1;
    };
    var matchesRequest = function(patient) {
        return patient["request"].toLowerCase().indexOf(radCtrl.params.request.toLowerCase()) !== -1;
    };
    var matchesPtCondition = function(patient) {
        return patient["Patient condition"].toLowerCase().indexOf(radCtrl.params.ptCondition.toLowerCase()) !== -1;
    }
    var matchesLocation = function(patient) {
        return patient["Location"].toLowerCase().indexOf(radCtrl.params.location.toLowerCase()) !== -1;
    }
}