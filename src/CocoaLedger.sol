// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title CocoaLedger
/// @notice Full lifecycle tracking for cacao lots on the Rayls Privacy Node.
///         Covers: Registration → IoT → AI Validation → Harvest → Post-harvest → Logistics → Tokenization → Sale → Reveal
///         All data is PRIVATE — only visible to the Privacy Node owner.
contract CocoaLedger {

    // ─── Enums ─────────────────────────────────────────────────────────

    enum LotStatus {
        Registered,     // 0 — Initial registration
        Growing,        // 1 — IoT data being collected
        Validated,      // 2 — AI has validated the crop
        Harvested,      // 3 — Cacao harvested
        Fermenting,     // 4 — In fermentation
        Drying,         // 5 — In drying process
        PostHarvest,    // 6 — Post-harvest complete
        InTransit,      // 7 — Being transported
        Stored,         // 8 — In warehouse/storage
        Tokenized,      // 9 — NFT minted
        Listed,         // 10 — Listed on marketplace
        Sold,           // 11 — Purchased
        Revealed        // 12 — Private data revealed to buyer
    }

    // ─── Structs ───────────────────────────────────────────────────────

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
        LotStatus status;
        uint256 aiScore;
    }

    struct LotDetails {
        uint256 farmAltitude;
        uint256 fermentDays;
        string  dryingMethod;
        uint256 humidityPct;      // final humidity * 100
        uint256 farmerExpYears;
        uint256 flavorAcidity;    // * 10
        uint256 flavorBitterness;
        uint256 flavorFruitiness;
        uint256 flavorFloral;
        uint256 flavorBody;
    }

    struct HarvestData {
        uint256 timestamp;
        uint256 quantityKg;
        string  fruitColor;
        string  fruitSize;       // small / medium / large
        string  healthStatus;    // healthy / disease_detected / mixed
        string  diseaseNotes;    // e.g. "monilia 5%" or "none"
    }

    struct PostHarvestData {
        uint256 fermentStartTime;
        uint256 fermentEndTime;
        string  fermentMethod;     // box / heap / basket
        uint256 fermentTempAvg;    // °C * 100
        uint256 dryStartTime;
        uint256 dryEndTime;
        string  dryMethod;         // solar / mechanical / hybrid
        uint256 finalMoisturePct;  // * 100
        uint256 finalWeightKg;
    }

    struct LogisticsCheckpoint {
        uint256 timestamp;
        string  location;        // PRIVATE — origin, checkpoint, destination
        string  status;          // departed / in_transit / arrived / stored
        uint256 temperature;     // °C * 100 (transport conditions)
        uint256 humidity;        // % * 100
        string  handler;         // PRIVATE — who handled the lot
    }

    struct AIValidation {
        uint256 timestamp;
        uint256 score;           // 0-100
        string  result;          // valid / invalid / needs_review
        string  analysisHash;    // IPFS or hash of full analysis
        string  diseaseDetected; // none / monilia / escoba_de_bruja / other
        string  notes;
    }

    struct SaleRecord {
        uint256 timestamp;
        address buyer;
        uint256 priceUsd;       // USD cents
        uint256 nftTokenId;
        bool    revealed;
    }

    // ─── Storage ───────────────────────────────────────────────────────

    mapping(uint256 => CacaoLot) public lots;
    mapping(uint256 => LotDetails) public lotDetails;
    mapping(uint256 => IoTReading[]) public iotReadings;
    mapping(uint256 => HarvestData) public harvests;
    mapping(uint256 => PostHarvestData) public postHarvests;
    mapping(uint256 => LogisticsCheckpoint[]) public logistics;
    mapping(uint256 => AIValidation[]) public aiValidations;
    mapping(uint256 => SaleRecord) public sales;

    uint256 public lotCount;
    address public owner;

    // ─── Events ────────────────────────────────────────────────────────

    event LotRegistered(uint256 indexed lotId, string variety, uint256 weightKg);
    event StatusChanged(uint256 indexed lotId, LotStatus newStatus);
    event IoTDataRecorded(uint256 indexed lotId, uint256 timestamp, uint256 temperature, uint256 humidity);
    event AIValidated(uint256 indexed lotId, uint256 score, string result);
    event Harvested(uint256 indexed lotId, uint256 quantityKg, string healthStatus);
    event PostHarvestComplete(uint256 indexed lotId, uint256 finalWeightKg, uint256 moisturePct);
    event LogisticsUpdated(uint256 indexed lotId, string location, string status);
    event LotTokenized(uint256 indexed lotId, uint256 nftTokenId);
    event LotSold(uint256 indexed lotId, address buyer, uint256 priceUsd);
    event LotRevealed(uint256 indexed lotId, address buyer);

    // ─── Modifiers ─────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ─── Registration ──────────────────────────────────────────────────

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
            status: LotStatus.Registered,
            aiScore: 0
        });
        emit LotRegistered(lotId, _variety, _weightKg);
        emit StatusChanged(lotId, LotStatus.Registered);
    }

    function setLotDetails(
        uint256 _lotId,
        uint256 _farmAltitude,
        uint256 _fermentDays,
        string calldata _dryingMethod,
        uint256 _humidityPct,
        uint256 _farmerExpYears,
        uint256[5] calldata _flavor
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

    // ─── IoT Data ──────────────────────────────────────────────────────

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
        if (lots[_lotId].status == LotStatus.Registered) {
            lots[_lotId].status = LotStatus.Growing;
            emit StatusChanged(_lotId, LotStatus.Growing);
        }
        emit IoTDataRecorded(_lotId, block.timestamp, _temperature, _humidity);
    }

    // ─── AI Validation ─────────────────────────────────────────────────

    function recordAIValidation(
        uint256 _lotId,
        uint256 _score,
        string calldata _result,
        string calldata _analysisHash,
        string calldata _diseaseDetected,
        string calldata _notes
    ) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        require(_score <= 100, "Score 0-100");
        aiValidations[_lotId].push(AIValidation({
            timestamp: block.timestamp,
            score: _score,
            result: _result,
            analysisHash: _analysisHash,
            diseaseDetected: _diseaseDetected,
            notes: _notes
        }));
        lots[_lotId].aiScore = _score;
        lots[_lotId].status = LotStatus.Validated;
        emit AIValidated(_lotId, _score, _result);
        emit StatusChanged(_lotId, LotStatus.Validated);
    }

    // ─── Harvest ───────────────────────────────────────────────────────

    function recordHarvest(
        uint256 _lotId,
        uint256 _quantityKg,
        string calldata _fruitColor,
        string calldata _fruitSize,
        string calldata _healthStatus,
        string calldata _diseaseNotes
    ) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        harvests[_lotId] = HarvestData({
            timestamp: block.timestamp,
            quantityKg: _quantityKg,
            fruitColor: _fruitColor,
            fruitSize: _fruitSize,
            healthStatus: _healthStatus,
            diseaseNotes: _diseaseNotes
        });
        lots[_lotId].status = LotStatus.Harvested;
        emit Harvested(_lotId, _quantityKg, _healthStatus);
        emit StatusChanged(_lotId, LotStatus.Harvested);
    }

    // ─── Post-Harvest ──────────────────────────────────────────────────

    function recordPostHarvest(
        uint256 _lotId,
        uint256 _fermentStart,
        uint256 _fermentEnd,
        string calldata _fermentMethod,
        uint256 _fermentTempAvg,
        uint256 _dryStart,
        uint256 _dryEnd,
        string calldata _dryMethod,
        uint256 _finalMoisture,
        uint256 _finalWeight
    ) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        postHarvests[_lotId] = PostHarvestData({
            fermentStartTime: _fermentStart,
            fermentEndTime: _fermentEnd,
            fermentMethod: _fermentMethod,
            fermentTempAvg: _fermentTempAvg,
            dryStartTime: _dryStart,
            dryEndTime: _dryEnd,
            dryMethod: _dryMethod,
            finalMoisturePct: _finalMoisture,
            finalWeightKg: _finalWeight
        });
        lots[_lotId].status = LotStatus.PostHarvest;
        emit PostHarvestComplete(_lotId, _finalWeight, _finalMoisture);
        emit StatusChanged(_lotId, LotStatus.PostHarvest);
    }

    // ─── Logistics ─────────────────────────────────────────────────────

    function recordLogisticsCheckpoint(
        uint256 _lotId,
        string calldata _location,
        string calldata _status,
        uint256 _temperature,
        uint256 _humidity,
        string calldata _handler
    ) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        logistics[_lotId].push(LogisticsCheckpoint({
            timestamp: block.timestamp,
            location: _location,
            status: _status,
            temperature: _temperature,
            humidity: _humidity,
            handler: _handler
        }));
        lots[_lotId].status = LotStatus.InTransit;
        emit LogisticsUpdated(_lotId, _location, _status);
        emit StatusChanged(_lotId, LotStatus.InTransit);
    }

    // ─── Tokenization & Sale ───────────────────────────────────────────

    function recordTokenization(uint256 _lotId, uint256 _nftTokenId) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        sales[_lotId].nftTokenId = _nftTokenId;
        lots[_lotId].status = LotStatus.Tokenized;
        emit LotTokenized(_lotId, _nftTokenId);
        emit StatusChanged(_lotId, LotStatus.Tokenized);
    }

    function recordSale(uint256 _lotId, address _buyer, uint256 _priceUsd) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        sales[_lotId].timestamp = block.timestamp;
        sales[_lotId].buyer = _buyer;
        sales[_lotId].priceUsd = _priceUsd;
        lots[_lotId].status = LotStatus.Sold;
        emit LotSold(_lotId, _buyer, _priceUsd);
        emit StatusChanged(_lotId, LotStatus.Sold);
    }

    function recordReveal(uint256 _lotId) external onlyOwner {
        require(_lotId < lotCount, "Lot does not exist");
        sales[_lotId].revealed = true;
        lots[_lotId].status = LotStatus.Revealed;
        emit LotRevealed(_lotId, sales[_lotId].buyer);
        emit StatusChanged(_lotId, LotStatus.Revealed);
    }

    // ─── Getters ───────────────────────────────────────────────────────

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

    function getHarvest(uint256 _lotId) external view returns (HarvestData memory) {
        return harvests[_lotId];
    }

    function getPostHarvest(uint256 _lotId) external view returns (PostHarvestData memory) {
        return postHarvests[_lotId];
    }

    function getLogistics(uint256 _lotId) external view returns (LogisticsCheckpoint[] memory) {
        return logistics[_lotId];
    }

    function getLogisticsCount(uint256 _lotId) external view returns (uint256) {
        return logistics[_lotId].length;
    }

    function getAIValidations(uint256 _lotId) external view returns (AIValidation[] memory) {
        return aiValidations[_lotId];
    }

    function getSale(uint256 _lotId) external view returns (SaleRecord memory) {
        return sales[_lotId];
    }
}
