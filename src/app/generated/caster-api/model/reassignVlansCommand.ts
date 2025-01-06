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


export interface ReassignVlansCommand { 
    /**
     * The Id of the partition the VLANs are being reassigned from
     */
    fromPartitionId?: string;
    /**
     * The Id of the partition the VLANs should be reassigned to
     */
    toPartitionId?: string;
    /**
     * The VLANs to reassign
     */
    vlanIds?: Array<string> | null;
}

