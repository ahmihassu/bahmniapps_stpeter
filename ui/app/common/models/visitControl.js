'use strict';

Bahmni.Common.VisitControl = function (visitTypes, defaultVisitTypeName, encounterService,
                                       $translate, visitService) {
    var self = this;
    self.visitTypes = visitTypes;
    self.defaultVisitTypeName = defaultVisitTypeName;
    self.defaultVisitType = visitTypes.filter(function (visitType) {
        return visitType.name === defaultVisitTypeName;
    })[0];

    self.startButtonText = function (visitType) {
        return $translate.instant('REGISTRATION_START_VISIT', {visitType: visitType.name});
    };

    self.startVisit = function (visitType) {
        self.onStartVisit();
        self.selectedVisitType = visitType;
    };


    self.createVisitOnly = function (patientUuid, visitLocationUuid, isEmergency, isMedico) {
        var visitType = self.selectedVisitType || self.defaultVisitType;
        var visitDetails = {patient: patientUuid, visitType: visitType.uuid, location: visitLocationUuid};

        if(isEmergency && isMedico){
            return visitService.createEmergencyMedicoVisit(visitDetails);
        }
        else if(isEmergency){
            return visitService.createEmergencyVisit(visitDetails);
        }
        else if(isMedico){
            return visitService.createMedicoVisit(visitDetails);
        }
        else{
            return visitService.createVisit(visitDetails);
        }
        
        
    };
};

