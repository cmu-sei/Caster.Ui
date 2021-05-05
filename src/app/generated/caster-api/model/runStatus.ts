/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

/**
 * Caster API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1.1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


export type RunStatus = 'Queued' | 'Failed' | 'Rejected' | 'Planning' | 'Planned' | 'Applying' | 'Applied' | 'Applied - State Error' | 'Failed - State Error';

export const RunStatus = {
    Queued: 'Queued' as RunStatus,
    Failed: 'Failed' as RunStatus,
    Rejected: 'Rejected' as RunStatus,
    Planning: 'Planning' as RunStatus,
    Planned: 'Planned' as RunStatus,
    Applying: 'Applying' as RunStatus,
    Applied: 'Applied' as RunStatus,
    AppliedStateError: 'Applied - State Error' as RunStatus,
    FailedStateError: 'Failed - State Error' as RunStatus
};

