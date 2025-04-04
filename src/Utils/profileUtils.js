const isFreelancerProfileComplete = (freelancerProfile) => {
    return (
      freelancerProfile.city &&
      freelancerProfile.pinCode &&
      freelancerProfile.state &&
      freelancerProfile.jobTitle &&
      freelancerProfile.overview &&
      freelancerProfile.skills.length > 0 &&
      freelancerProfile.minimumRate != null && // Use != null to check for undefined/null
      freelancerProfile.maximumRate != null &&
      freelancerProfile.weeklyHours != null &&
      freelancerProfile.availabilityStatus !== "UNAVAILABLE"
    );
  };

export {isFreelancerProfileComplete}