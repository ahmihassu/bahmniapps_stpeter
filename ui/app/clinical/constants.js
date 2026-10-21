'use strict';

Bahmni.Clinical.Constants = (function () {
    var hostURL = Bahmni.Common.Constants.hostURL + Bahmni.Common.Constants.RESTWS_V1;
    var orderTypes = {
        lab: "Lab Order",
        radiology: "Radiology Order"
    };
    var dosingTypes = {
        uniform: "uniform",
        variable: "variable"
    };
    var orderActions = {
        discontinue: 'DISCONTINUE',
        new: 'NEW',
        revise: 'REVISE'
    };
    var concepts = {
        age: "Age",
        weight: "Weight"
    };
    var errorMessages = {
        discontinuingAndOrderingSameDrug: "DISCONTINUING_AND_ORDERING_SAME_DRUG_NOT_ALLOWED",
        incompleteForm: "INCOMPLETE_FORM_ERROR_MESSAGE",
        invalidItems: "Highlighted items in New Prescription section are incomplete. Please edit or remove them to continue",
        conceptNotNumeric: "CONCEPT_NOT_NUMERIC"
    };
    var bacteriologyConstants = {
        otherSampleType: "Other",
        specimenSampleSourceConceptName: "Specimen Sample Source"

    };
    return {
        patientsListUrl: "/patient/search",
        diagnosisObservationConceptName: "Visit Diagnoses",
        orderConceptName: "Diagnosis order",                   // TODO : should be fetched from a config
        certaintyConceptName: "Diagnosis Certainty",           // TODO : should be fetched from a config
        nonCodedDiagnosisConceptName: "Non-coded Diagnosis",       // TODO : should be fetched from a config
        codedDiagnosisConceptName: "Coded Diagnosis",      // TODO : should be fetched from a config
        orderTypes: orderTypes,
        labOrderType: "Lab Order",
        drugOrderType: "Drug Order",
        labConceptSetName: "Lab Samples",
        testConceptName: "LabTest",
        labSetConceptName: "LabSet",
        labDepartmentsConceptSetName: "Lab Departments",
        otherInvestigationsConceptSetName: "Other Investigations",
        otherInvestigationCategoriesConceptSetName: "Other Investigations Categories",
        commentConceptName: "COMMENTS",
        messageForNoLabOrders: "NO_LAB_ORDERS_MESSAGE",
        messageForNoObservation: "NO_OBSERVATIONS_CAPTURED",
        messageForNoActiveVisit: "NO_ACTIVE_VISIT_MESSAGE",
        dischargeSummaryConceptName: "Discharge Summary",
        flexibleDosingInstructionsClass: "org.openmrs.module.bahmniemrapi.drugorder.dosinginstructions.FlexibleDosingInstructions",
        reviseAction: 'REVISE',
        asDirectedInstruction: 'As directed',
        dosingTypes: dosingTypes,
        orderActions: orderActions,
        errorMessages: errorMessages,
        caseIntakeConceptClass: 'Case Intake',
        dialog: 'DIALOG',
        dashboard: 'DASHBOARD',
        default: 'DEFAULT',
        gender: 'Gender',
        concepts: concepts,
        bacteriologyResultPrivilege: "Bacteriology Results",
        collectSamplePrivilege: "Collect Sample",
        editSpecialOrderPrivilege: "Edit Special Order",
        otherActiveDrugOrders: "Other Active DrugOrders",
        dispensePrivilege: "bahmni:clinical:dispense",
        mandatoryVisitConfigUrl: "config/visitMandatoryTab.json",
        defaultExtensionName: "default",
        bacteriologyConstants: bacteriologyConstants,
        globalPropertyToFetchActivePatients: 'emrapi.sqlSearch.activePatients',
        adtPrivilege: "app:adt",
        adtForwardUrl: "../adt/#/patient/{{patientUuid}}/visit/{{visitUuid}}/",
        regexForTime: /^(?:(?:1[0-2]|0?[1-9]):[0-5]\d\s*[AaPp][Mm])?$/,
        minDurationForAppointment: 30,
        privilegeManageAppointments: 'app:clinical',
        providerResponses: { ACCEPTED: "ACCEPTED", REJECTED: "REJECTED", TENTATIVE: "TENTATIVE", CANCELLED: "CANCELLED", AWAITING: "AWAITING" },
        createServiceUrl: hostURL + '/appointmentService',
        getServiceLoad: hostURL + '/appointmentService/load',
        getAllSpecialitiesUrl: hostURL + '/speciality/all',
        createAppointmentUrl: hostURL + '/appointment',
        getAppointmentsForServiceTypeUrl: hostURL + '/appointment/futureAppointmentsForServiceType/',
        changeAppointmentStatusUrl: hostURL + '/appointments/{{appointmentUuid}}/status-change',
        getAppointmentByUuid: hostURL + '/appointment/',
        getAllAppointmentsUrl: hostURL + '/appointment/all',
        searchAppointmentUrl: hostURL + '/appointment/search',
        searchAppointmentsUrl: hostURL + '/appointments/search',
        getAppointmentsSummaryUrl: hostURL + '/appointment/appointmentSummary',
        availableForAppointments: 'Available for appointments',

        // ── O2 Therapy Constants ──────────────────────────────────────────────
        o2OrderType: "O2 Order",
        o2FlowRateUnits: "L/min",
        // Billing window: 24h in production (1440 min). Check happens on form
        // save, not on a timer — so this is the threshold, not a polling interval.
        o2BillingWindowMinutes: 2,   // 1440 for production (24h)
        o2SessionStatus: {
            active: 'ACTIVE',
            discontinued: 'DISCONTINUED',
            completed: 'COMPLETED'
        },
        // o2OrderTypeUuid: '09dbd118-63fc-11f1-825a-de9e4d08faa1',
        // o2OrderConceptUuid: 'ba52c82c-6833-4cfa-be21-e7174ead564d',
        // // Encounter type UUID for Consultation — used in billing encounter payload
        // consultationEncounterTypeUuid: '81852aee-3f10-11e4-adec-0800271c1b75',
        // // Concept UUIDs — St. Peter Oxygen Consumption Registration Form
        // o2Concepts: {
        //     formConceptUuid: '25919a2b-5f0a-42f4-8ce0-f8f10ec49eca',
        //     flowRate: '76d0e930-b141-479c-90a3-356ff9d603df',
        //     startTime: '329088d7-1f26-4e51-899a-1e32cc418644',
        //     endTime: 'ae427d96-82c2-4d87-bf10-f51d4ac79705',
        //     patientOffO2: '090a9658-9b60-4cdd-ae1b-c9d95aff8895',
        //     lastOdooPushTimestamp: 'fb165d90-adbd-4575-95cf-b7d572222424',
        //     billingTotalLiters: 'b4f79190-e6cf-4877-91b0-78cb8fdcc2e8',
        //     billingDurationMinutes: 'a329c046-b1bc-4586-b4be-fc83791a2126',
        //     billingTrigger: '3651980b-d1b0-4e47-89bb-a7f905b70e63'
        // }
        o2OrderTypeUuid: 'b6e6274c-4a24-11f1-9af3-0242ac120003',
        o2OrderConceptUuid: 'f0a1a42e-ed22-4d31-9565-52704f7d15d0',
        o2CareSettingUuid: 'c365e560-c3ec-11e3-9c1a-0800200c9a66',
        // Encounter type UUID for Consultation — used in billing encounter payload
        consultationEncounterTypeUuid: '81852aee-3f10-11e4-adec-0800271c1b75',
        // Concept UUIDs — St. Peter Oxygen Consumption Registration Form
        o2Concepts: {
            formConceptUuid: '25919a2b-5f0a-42f4-8ce0-f8f10ec49eca',
            flowRate: '76d0e930-b141-479c-90a3-356ff9d603df',
            startTime: '329088d7-1f26-4e51-899a-1e32cc418644',
            endTime: 'ae427d96-82c2-4d87-bf10-f51d4ac79705',
            patientOffO2: '090a9658-9b60-4cdd-ae1b-c9d95aff8895',
            lastOdooPushTimestamp: 'fb165d90-adbd-4575-95cf-b7d572222424',
            billingTotalLiters: 'b4f79190-e6cf-4877-91b0-78cb8fdcc2e8',
            billingDurationMinutes: 'a329c046-b1bc-4586-b4be-fc83791a2126',
            billingTrigger: '3651980b-d1b0-4e47-89bb-a7f905b70e63'
        }
    };
})();
