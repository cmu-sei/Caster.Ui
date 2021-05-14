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
import { Apply } from './apply';
import { RunStatus } from './runStatus';
import { Plan } from './plan';


export interface Run { 
    /**
     * A unique identifier
     */
    id?: string;
    /**
     * The unique identifier of the Workspace this Run was created for
     */
    workspaceId?: string;
    /**
     * Wether or not this Run was for a Destroy command
     */
    isDestroy?: boolean;
    status?: RunStatus;
    /**
     * Optional list of resources to constrain the affects of this Run to
     */
    targets?: Array<string> | null;
    plan?: Plan;
    /**
     * The Id of the Plan for this Run. Null if no Plan exists.
     */
    planId?: string | null;
    apply?: Apply;
    /**
     * The Id of the Apply for this Run. Null if no Apply exists.
     */
    applyId?: string | null;
    /**
     * The time in UTC that this Run was initially created
     */
    createdAt?: string;
    /**
     * The Id of the User who created this Run
     */
    createdById?: string | null;
    /**
     * The Name of the User who created this Run
     */
    createdBy?: string | null;
    /**
     * The time in UTC that this Run was last modified (Applied, Rejected, etc)
     */
    modifiedAt?: string | null;
    /**
     * The Id of the User who last modified this Run
     */
    modifiedById?: string | null;
    /**
     * The Name of the User who last modified this Run
     */
    modifiedBy?: string | null;
}

