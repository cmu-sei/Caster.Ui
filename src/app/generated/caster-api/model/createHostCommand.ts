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


export interface CreateHostCommand { 
    /**
     * Name of the Host
     */
    name?: string | null;
    /**
     * Name of the datastore to use with this Host
     */
    datastore?: string | null;
    /**
     * Maximum number of mahcines to deploy to this Host
     */
    maximumMachines?: number;
    /**
     * True if this Host should be selected for deployments
     */
    enabled?: boolean;
    /**
     * True if this Host should not be automatically selected for deployments and only used for development purposes, manually
     */
    development?: boolean;
    /**
     * The Id of the Project to assign this Host to
     */
    projectId?: string | null;
}

