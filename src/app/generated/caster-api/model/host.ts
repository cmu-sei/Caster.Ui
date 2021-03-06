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


export interface Host { 
    /**
     * ID of the Host.
     */
    id?: string;
    /**
     * Name of the Host.
     */
    name?: string | null;
    /**
     * The name of the datastore to use for this Host
     */
    datastore?: string | null;
    /**
     * The maximum number of machines to deploy to this Host for DynamicHost Workspaces
     */
    maximumMachines?: number;
    /**
     * If true, use this Host when deploying to a DynamicHost Workspace
     */
    enabled?: boolean;
    /**
     * If true, use this Host only for manual deployments
     */
    development?: boolean;
    /**
     * The Project this Host is assigned to, if any
     */
    projectId?: string | null;
}

