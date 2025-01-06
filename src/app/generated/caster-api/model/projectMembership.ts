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


export interface ProjectMembership { 
    id?: string;
    /**
     * ID of the project.
     */
    projectId?: string;
    /**
     * Id of the User.
     */
    userId?: string | null;
    /**
     * Id of the Group.
     */
    groupId?: string | null;
    /**
     * Id of the Role this User has for this Project
     */
    roleId?: string | null;
}

