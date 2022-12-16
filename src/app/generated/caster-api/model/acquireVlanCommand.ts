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


export interface AcquireVlanCommand { 
    /**
     * The Id of the Project the VLAN should come from
     */
    projectId?: string | null;
    /**
     * The Id of the partition the VLAN should come from
     */
    partitionId?: string | null;
    tag?: string | null;
    vlanId?: number | null;
}

