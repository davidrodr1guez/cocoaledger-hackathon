// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title CocoaLedger
/// @notice On-chain storage for cacao farm IoT data on the Rayls Privacy Node.
///         This data is PRIVATE — only visible to the Privacy Node owner.
///         AI agents read this data to verify quality and produce public attestations.
contract CocoaLedger {

    struct IoTReading {
        uint256 timestamp;
        int256  latitude;       // Scaled by 1e6
        int256  longitude;      // Scaled by 1e6
        uint256 altitude;       // meters
        uint256 soilMoisture;   // % * 100
        uint256 soilPH;         // pH * 100
        uint256 temperature;    // °C * 100
        uint256 humidity;       // % * 100
        uint256 rainfall;       // mm * 100
    }

    struct CacaoLot {
        uint256 lotId;
        uint256 createdAt;
        string  variety;
        string  region;           // PRIVATE
        string  cooperativeName;  // PRIVATE
        uint256 weightKg;
        string  harvest;
        string  certifications;
        uint256 purchasePricePerKg; // USD cents — MOST PRIVATE
        bool    verified;
        uint256 aiScore;
    }

    // Separate struct to avoid stack too deep
    struct LotDetails {
        uint256 farmAltitude;
        uint256 fermentDays;
        string  dryingMethod;
        uint256 humidityPct;      // final humidity * 100
        uint256 farmerExpYears;
        // Flavor profile (* 10)
        uint256 flavorAcidity;
        uint256 flavorBitterness;
        uint256 flavorFruitiness;
        uint256 flavorFloral;
        uint256 flavorBody;
    }

    mapping(uint256 => CacaoLot) public lots;
    mapping(uint256 => LotDetails) public lotDetails;
    mapping(uint256 => IoTReading[]) public iotReadings;
    uint256 public lotCount;
    address public owner;

    event LotRegistered(uint256 indexed lotId, string variety, uint256 weightKg);
    event IoTDataRecorded(uint256 indexed lotId, uint256 timestamp, uint256 temperature, uint256 humidity);
    event LotVerified(uint256 indexed lotId, uint256 aiScore);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /// @notice Register a new cacao lot — basic info
    function registerLot(
        string calldata _variety,
        string calldata _region,
        string calldata _cooperativeName,
        uint256 _weightKg,
        string calldata _harvest,
        string calldata _certifications,
        uint256 _purchasePrice
    ) external onlyOwner returns (uint256 lotId) {
        lotId = lotCount++;
        lots[lotId] = CacaoLot({
            lotId: lotId,
            createdAt: block.timestamp,
            variety: _variety,
            region: _region,
            cooperativeName: _cooperativeName,
            weightKg: _weightKg,
            harvest: _harvest,
            certifications: _certifications,
            purchasePricePerKg: _purchasePrice,
            verified: false,
            aiScore: 0
        });
        emit LotRegistered(lotId, _variety, _weightKg);
    }

    /// @notice Set lot processing and flavor details
    function setLotDetails(
        uint256 _lotId,
        uint256 _farmAltitude,
        uint256 _fermentDays,
        string calldata _dryingMethod,
        uint256 _humidityPct,
        uint256 _farmerExpYears,
        uint256[5] calldata _flavor // [acidity, bitterness, fruitiness, floral, body] *10
    ) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        lotDetails[_lotId] = LotDetails({
            farmAltitude: _farmAltitude,
            fermentDays: _fermentDays,
            dryingMethod: _dryingMethod,
            humidityPct: _humidityPct,
            farmerExpYears: _farmerExpYears,
            flavorAcidity: _flavor[0],
            flavorBitterness: _flavor[1],
            flavorFruitiness: _flavor[2],
            flavorFloral: _flavor[3],
            flavorBody: _flavor[4]
        });
    }

    /// @notice Record IoT sensor data for a lot
    function recordIoTData(
        uint256 _lotId,
        int256 _latitude,
        int256 _longitude,
        uint256 _altitude,
        uint256 _soilMoisture,
        uint256 _soilPH,
        uint256 _temperature,
        uint256 _humidity,
        uint256 _rainfall
    ) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        iotReadings[_lotId].push(IoTReading({
            timestamp: block.timestamp,
            latitude: _latitude,
            longitude: _longitude,
            altitude: _altitude,
            soilMoisture: _soilMoisture,
            soilPH: _soilPH,
            temperature: _temperature,
            humidity: _humidity,
            rainfall: _rainfall
        }));
        emit IoTDataRecorded(_lotId, block.timestamp, _temperature, _humidity);
    }

    /// @notice Mark lot as verified by AI with score
    function markVerified(uint256 _lotId, uint256 _aiScore) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        require(_aiScore <= 100, "Score 0-100");
        lots[_lotId].verified = true;
        lots[_lotId].aiScore = _aiScore;
        emit LotVerified(_lotId, _aiScore);
    }

    function getLot(uint256 _lotId) external view returns (CacaoLot memory) {
        require(_lotId < lotCount, "Lot does not exist");
        return lots[_lotId];
    }

    function getLotDetails(uint256 _lotId) external view returns (LotDetails memory) {
        return lotDetails[_lotId];
    }

    function getIoTReadings(uint256 _lotId) external view returns (IoTReading[] memory) {
        return iotReadings[_lotId];
    }

    function getIoTReadingCount(uint256 _lotId) external view returns (uint256) {
        return iotReadings[_lotId].length;
    }
}
