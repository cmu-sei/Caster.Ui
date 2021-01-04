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


export interface Resource { 
    /**
     * The Id of this Resource
     */
    id?: string | null;
    /**
     * The Name of this Resource
     */
    name?: string | null;
    /**
     * The Terraform identifier for the type of this Resource.  e.g. vsphere_virtual_machine, vsphere_virtual_network, etc
     */
    type?: string | null;
    /**
     * The Terraform Resource Address that references this Resource\'s Base Resource.  If this Resource was created with count > 1, using the Base Address as a target  will target all of the resources created from it.  BaseAddress will be null if the Resource was created with count = 1.
     */
    baseAddress?: string | null;
    /**
     * The Terraform Resource Address that references this specific Resource.  Used for the targets list when creating a Run
     */
    address?: string | null;
    /**
     * True if this Resource is tainted, meaning it will be destroyed and re-created on next Run
     */
    tainted?: boolean;
    /**
     * Type-specific additional attributes for searching on. Always returned.
     */
    searchableAttributes?: { [key: string]: object; } | null;
    /**
     * Raw json of all additional type-specific attributes. Only returned when requesting a single Resource; otherwise null.
     */
    attributes?: object | null;
}

