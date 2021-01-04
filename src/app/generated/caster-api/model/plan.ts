// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

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
import { PlanStatus } from './planStatus';


export interface Plan { 
    /**
     * A unique identifier
     */
    id?: string;
    /**
     * The unique identifier of the Run this Plan is associated with
     */
    runId?: string;
    status?: PlanStatus;
    /**
     * The raw Terraform output of the Plan command
     */
    output?: string | null;
}

